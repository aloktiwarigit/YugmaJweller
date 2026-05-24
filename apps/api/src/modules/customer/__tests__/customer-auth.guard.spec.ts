import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CustomerAuthGuard } from '../customer-auth.guard';
import type { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';

// Two-layer mock:
// - pool.query rows: used by assertActiveShop (called on pool directly)
// - client.query rows: used by withShopTx internals (BEGIN, SET LOCAL ROLE, set_config, fn, COMMIT, poison)
function makePool(opts: {
  poolRows: Record<string, unknown>[][];  // pool.query calls (assertActiveShop)
  clientRows: Record<string, unknown>[][]; // withShopTx: BEGIN, SET LOCAL ROLE, set_config, fn queries, COMMIT, poison
}) {
  let poolCall = 0;
  let clientCall = 0;

  const client = {
    query: vi.fn().mockImplementation(() => {
      const result = opts.clientRows[clientCall] ?? [];
      clientCall++;
      return Promise.resolve({ rows: result });
    }),
    release: vi.fn(),
  };

  return {
    query: vi.fn().mockImplementation(() => {
      const result = opts.poolRows[poolCall] ?? [];
      poolCall++;
      return Promise.resolve({ rows: result });
    }),
    connect: vi.fn().mockResolvedValue(client),
  };
}

// withShopTx prefixes: BEGIN, SET LOCAL ROLE app_user, SELECT set_config
// and appends COMMIT + poison to fn rows.
function withTxSetup(fnRows: Record<string, unknown>[][]): Record<string, unknown>[][] {
  return [
    [],  // BEGIN
    [],  // SET LOCAL ROLE app_user
    [],  // SELECT set_config (GUC)
    ...fnRows,
    [],  // COMMIT
    [],  // SELECT set_config (poison, finally)
  ];
}

function withTxRollback(fnRows: Record<string, unknown>[][]): Record<string, unknown>[][] {
  return [
    [],  // BEGIN
    [],  // SET LOCAL ROLE app_user
    [],  // SELECT set_config (GUC)
    ...fnRows,
    [],  // ROLLBACK
    [],  // SELECT set_config (poison, finally)
  ];
}

const mockVerifyIdToken = vi.fn();
const mockFirebase = {
  admin: () => ({ auth: () => ({ verifyIdToken: mockVerifyIdToken }) }),
} as unknown as FirebaseAdminProvider;

function makeCtx(headers: Record<string, string>): ExecutionContext {
  const req = { headers, customerCtx: undefined };
  return { switchToHttp: () => ({ getRequest: () => req }) } as never;
}

describe('CustomerAuthGuard (extended)', () => {
  const SHOP_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => { vi.clearAllMocks(); });

  it('sets customerCtx when firebase_uid found in DB', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'fb-uid', phone_number: '+91999' });
    const pool = makePool({
      poolRows: [[{ status: 'ACTIVE' }]],   // assertActiveShop
      clientRows: withTxSetup([
        [{ id: 'db-uuid', firebase_uid: 'fb-uid' }],  // SELECT WHERE firebase_uid
      ]),
    });
    const guard = new CustomerAuthGuard(mockFirebase, pool as never);
    const ctx = makeCtx({ authorization: 'Bearer tok', 'x-tenant-id': SHOP_ID });
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    const req = ctx.switchToHttp().getRequest() as Record<string, unknown>;
    expect((req.customerCtx as Record<string, unknown>)?.customerId).toBe('db-uuid');
  });

  it('lazy migration — links phone customer when firebase_uid lookup fails', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'fb-uid', phone_number: '+91999' });
    const pool = makePool({
      poolRows: [[{ status: 'ACTIVE' }]],   // assertActiveShop
      clientRows: withTxSetup([
        [],                    // firebase_uid SELECT → not found
        [{ id: 'old-uuid' }], // phone SELECT FOR UPDATE → found
        [{ id: 'old-uuid' }], // UPDATE SET firebase_uid RETURNING id
      ]),
    });
    const guard = new CustomerAuthGuard(mockFirebase, pool as never);
    const ctx = makeCtx({ authorization: 'Bearer tok', 'x-tenant-id': SHOP_ID });
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    const req = ctx.switchToHttp().getRequest() as Record<string, unknown>;
    expect((req.customerCtx as Record<string, unknown>)?.customerId).toBe('old-uuid');
  });

  it('throws not_provisioned when firebase_uid not found and no phone in token', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'fb-uid', email: 'a@b.com' });
    const pool = makePool({
      poolRows: [[{ status: 'ACTIVE' }]],   // assertActiveShop
      clientRows: withTxRollback([
        [],  // firebase_uid SELECT → not found (no phone → throws not_provisioned)
      ]),
    });
    const guard = new CustomerAuthGuard(mockFirebase, pool as never);
    const ctx = makeCtx({ authorization: 'Bearer tok', 'x-tenant-id': SHOP_ID });
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: { code: 'customer.not_provisioned' },
    });
  });

  it('throws 401 when authorization header missing', async () => {
    const pool = makePool({ poolRows: [], clientRows: [] });
    const guard = new CustomerAuthGuard(mockFirebase, pool as never);
    const ctx = makeCtx({ 'x-tenant-id': SHOP_ID });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
