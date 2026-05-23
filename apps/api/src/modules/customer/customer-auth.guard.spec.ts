import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceUnavailableException, type ExecutionContext } from '@nestjs/common';
import {
  CustomerAuthGuard,
  CUSTOMER_SELF_REGISTRATION_ACTOR_ID,
  DEV_MOCK_BEARER_PREFIX,
  DEV_MOCK_CUSTOMER_ID,
} from './customer-auth.guard';
import type { Request } from 'express';
import type { Pool } from 'pg';
import type { FirebaseAdminProvider } from '../auth/firebase-admin.provider';

const SHOP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CUSTOMER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeExecutionContext(req: Request): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

function makeRequest(authorization: string): Request & { customerCtx?: unknown } {
  return {
    headers: {
      authorization,
      'x-tenant-id': SHOP_ID,
    },
  } as unknown as Request & { customerCtx?: unknown };
}

function makeFirebase(verifyIdToken = vi.fn()): FirebaseAdminProvider {
  return {
    admin: vi.fn(() => ({
      auth: () => ({ verifyIdToken }),
    })),
  } as unknown as FirebaseAdminProvider;
}

function makePool(): Pool {
  return { query: vi.fn() } as unknown as Pool;
}

describe('CustomerAuthGuard', () => {
  const originalNodeEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['NODE_ENV'] = 'test';
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalNodeEnv;
    }
  });

  it('allows the dev mock only for an active shop', async () => {
    const pool = makePool();
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ status: 'ACTIVE' }] } as never);
    const req = makeRequest(`Bearer ${DEV_MOCK_BEARER_PREFIX}customer`);
    const guard = new CustomerAuthGuard(makeFirebase(), pool);

    await expect(guard.canActivate(makeExecutionContext(req))).resolves.toBe(true);

    expect(pool.query).toHaveBeenCalledWith(
      `SELECT status FROM shops WHERE id = $1 LIMIT 1`,
      [SHOP_ID],
    );
    expect(req.customerCtx).toMatchObject({ customerId: DEV_MOCK_CUSTOMER_ID, shopId: SHOP_ID });
  });

  it('rejects the dev mock for a suspended shop', async () => {
    const pool = makePool();
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ status: 'SUSPENDED' }] } as never);
    const req = makeRequest(`Bearer ${DEV_MOCK_BEARER_PREFIX}customer`);
    const guard = new CustomerAuthGuard(makeFirebase(), pool);

    await expect(guard.canActivate(makeExecutionContext(req)))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(req.customerCtx).toBeUndefined();
  });

  it('rejects the dev mock when the shop is missing', async () => {
    const pool = makePool();
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    const req = makeRequest(`Bearer ${DEV_MOCK_BEARER_PREFIX}customer`);
    const guard = new CustomerAuthGuard(makeFirebase(), pool);

    await expect(guard.canActivate(makeExecutionContext(req)))
      .rejects.toMatchObject({ response: { code: 'customer.shop_not_found' } });
    expect(req.customerCtx).toBeUndefined();
  });

  it('rejects a malformed tenant id before querying the database', async () => {
    const pool = makePool();
    const req = {
      headers: {
        authorization: `Bearer ${DEV_MOCK_BEARER_PREFIX}customer`,
        'x-tenant-id': 'not-a-uuid',
      },
    } as unknown as Request & { customerCtx?: unknown };
    const guard = new CustomerAuthGuard(makeFirebase(), pool);

    await expect(guard.canActivate(makeExecutionContext(req)))
      .rejects.toMatchObject({ response: { code: 'customer.tenant_id_invalid' } });
    expect(pool.query).not.toHaveBeenCalled();
    expect(req.customerCtx).toBeUndefined();
  });

  it('rejects a suspended shop on the Firebase path before customer lookup', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ phone_number: '+919876543210' });
    const pool = makePool();
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ status: 'SUSPENDED' }] } as never);
    const req = makeRequest('Bearer firebase-token');
    const guard = new CustomerAuthGuard(makeFirebase(verifyIdToken), pool);

    await expect(guard.canActivate(makeExecutionContext(req)))
      .rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(verifyIdToken).toHaveBeenCalledWith('firebase-token', false);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(req.customerCtx).toBeUndefined();
  });

  it('allows an active shop on the Firebase path — existing firebase_uid customer', async () => {
    // withShopTx falls back to fn(pool) when pool has no connect() — so pool.query is used for tx queries too
    const verifyIdToken = vi.fn().mockResolvedValue({ uid: 'fb-uid-abc', phone_number: '+919876543210' });
    const pool = makePool();
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ status: 'ACTIVE' }] } as never)  // assertActiveShop
      .mockResolvedValueOnce({ rows: [{ id: CUSTOMER_ID }] } as never);  // SELECT WHERE firebase_uid
    const req = makeRequest('Bearer firebase-token');
    const guard = new CustomerAuthGuard(makeFirebase(verifyIdToken), pool);

    await expect(guard.canActivate(makeExecutionContext(req))).resolves.toBe(true);

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      `SELECT id FROM customers\n         WHERE shop_id = $1 AND firebase_uid = $2 AND deleted_at IS NULL\n         LIMIT 1`,
      [SHOP_ID, 'fb-uid-abc'],
    );
    expect(req.customerCtx).toMatchObject({ customerId: CUSTOMER_ID, shopId: SHOP_ID });
  });

  it('lazy migrates phone-OTP customer on first Firebase login with phone token', async () => {
    // Customer exists with phone but no firebase_uid — guard writes firebase_uid and returns
    const verifyIdToken = vi.fn().mockResolvedValue({ uid: 'fb-uid-new', phone_number: '+919876543210' });
    const pool = makePool();
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ status: 'ACTIVE' }] } as never)   // assertActiveShop
      .mockResolvedValueOnce({ rows: [] } as never)                         // SELECT WHERE firebase_uid → not found
      .mockResolvedValueOnce({ rows: [{ id: CUSTOMER_ID }] } as never)     // SELECT WHERE phone FOR UPDATE → found
      .mockResolvedValueOnce({ rows: [{ id: CUSTOMER_ID }] } as never);    // UPDATE SET firebase_uid RETURNING id
    const req = makeRequest('Bearer firebase-token');
    const guard = new CustomerAuthGuard(makeFirebase(verifyIdToken), pool);

    await expect(guard.canActivate(makeExecutionContext(req))).resolves.toBe(true);

    expect(pool.query).toHaveBeenNthCalledWith(
      3,
      `SELECT id FROM customers\n           WHERE shop_id = $1 AND phone = $2 AND firebase_uid IS NULL AND deleted_at IS NULL\n           LIMIT 1\n           FOR UPDATE`,
      [SHOP_ID, '+919876543210'],
    );
    expect(req.customerCtx).toMatchObject({ customerId: CUSTOMER_ID, shopId: SHOP_ID, phoneFromToken: '+919876543210' });
  });

  it('rejects a missing shop on the Firebase path before customer lookup', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ phone_number: '+919876543210' });
    const pool = makePool();
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    const req = makeRequest('Bearer firebase-token');
    const guard = new CustomerAuthGuard(makeFirebase(verifyIdToken), pool);

    await expect(guard.canActivate(makeExecutionContext(req)))
      .rejects.toMatchObject({ response: { code: 'customer.shop_not_found' } });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(req.customerCtx).toBeUndefined();
  });
});
