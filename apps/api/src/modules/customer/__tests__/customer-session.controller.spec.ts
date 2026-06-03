import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { CustomerSessionController } from '../customer-session.controller';
import { CustomerSessionService } from '../customer-session.service';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
import { UnauthorizedException } from '@nestjs/common';

const mockVerifyIdToken = vi.fn();
const mockFirebase = { admin: () => ({ auth: () => ({ verifyIdToken: mockVerifyIdToken }) }) };
const mockPool = { query: vi.fn().mockResolvedValue({ rows: [] }) };
const mockService = { findOrCreateCustomerByFirebaseToken: vi.fn() };

describe('CustomerSessionController', () => {
  let controller: CustomerSessionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerSessionController],
      providers: [
        { provide: FirebaseAdminProvider, useValue: mockFirebase },
        { provide: 'PG_POOL', useValue: mockPool },
        { provide: CustomerSessionService, useValue: mockService },
      ],
    }).compile();
    controller = module.get(CustomerSessionController);
    vi.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: [] });
  });

  it('returns customer session when token is valid', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid', phone_number: '+919999999999' });
    mockService.findOrCreateCustomerByFirebaseToken.mockResolvedValue({
      customerId: 'db-uuid-1', name: 'Test', phoneE164: '+919999999999',
      email: null, authProvider: 'phone', isNewUser: false,
    });
    const req = {
      headers: {
        authorization: 'Bearer valid-token',
        'x-tenant-id': '11111111-1111-4111-8111-111111111111',
      },
    };
    const result = await controller.createSession(req as never);
    expect(result.customer.id).toBe('db-uuid-1');
    expect(result.isNewUser).toBe(false);
  });

  it('throws 401 when authorization header is missing', async () => {
    const req = { headers: { 'x-tenant-id': '11111111-1111-4111-8111-111111111111' } };
    await expect(controller.createSession(req as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when x-tenant-id header is missing', async () => {
    const req = { headers: { authorization: 'Bearer valid-token' } };
    await expect(controller.createSession(req as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when verifyIdToken rejects', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));
    const req = {
      headers: {
        authorization: 'Bearer bad-token',
        'x-tenant-id': '11111111-1111-4111-8111-111111111111',
      },
    };
    await expect(controller.createSession(req as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// A pool whose `connect()` yields a client drives withShopTx down its real
// transaction path (BEGIN → SET LOCAL ROLE → set_config → fn → COMMIT), so we can
// assert the tenant GUC is applied around the controller's writes (the semgrep
// require-tenant-transaction fix). The lightweight `{ query }` mock above can't —
// withShopTx short-circuits to fn(pool) when no `connect` exists.
describe('CustomerSessionController — tenant transaction wrapping', () => {
  const shopId = '11111111-1111-4111-8111-111111111111';

  function buildTxPool() {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    const pool = { connect: vi.fn().mockResolvedValue(client), query: vi.fn() };
    return { pool, client };
  }

  function queriedSql(client: { query: ReturnType<typeof vi.fn> }): string[] {
    return client.query.mock.calls.map((c) => String(c[0]));
  }

  it('writes the auth-failure audit event inside a shop transaction (GUC set)', async () => {
    const verify = vi.fn().mockRejectedValue(new Error('bad token'));
    const firebase = { admin: () => ({ auth: () => ({ verifyIdToken: verify }) }) };
    const { pool, client } = buildTxPool();
    const controller = new CustomerSessionController(
      firebase as never, pool as never, { findOrCreateCustomerByFirebaseToken: vi.fn() } as never,
    );

    await expect(
      controller.createSession({ headers: { authorization: 'Bearer x', 'x-tenant-id': shopId } } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const sql = queriedSql(client);
    expect(sql).toContain('BEGIN');
    expect(sql).toContain('COMMIT');
    // tenant GUC is bound to this shop before the audit insert runs
    expect(client.query).toHaveBeenCalledWith('SELECT set_config($1, $2, true)', [
      'app.current_shop_id', shopId,
    ]);
    expect(sql.some((s) => s.includes('INSERT INTO audit_events'))).toBe(true);
  });

  it('a fire-and-forget audit failure never masks the 401', async () => {
    const verify = vi.fn().mockRejectedValue(new Error('bad token'));
    const firebase = { admin: () => ({ auth: () => ({ verifyIdToken: verify }) }) };
    const pool = { connect: vi.fn().mockRejectedValue(new Error('pool exhausted')), query: vi.fn() };
    const controller = new CustomerSessionController(
      firebase as never, pool as never, { findOrCreateCustomerByFirebaseToken: vi.fn() } as never,
    );

    await expect(
      controller.createSession({ headers: { authorization: 'Bearer x', 'x-tenant-id': shopId } } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('runs the profile phone update inside a shop transaction', async () => {
    const { pool, client } = buildTxPool();
    const controller = new CustomerSessionController(
      { admin: () => ({}) } as never, pool as never, { findOrCreateCustomerByFirebaseToken: vi.fn() } as never,
    );
    const req = {
      customerCtx: { customerId: 'cust-1', shopId, firebaseUid: 'fb-1', phoneFromToken: '+919999999999' },
    };

    await expect(controller.addPhone(req as never)).resolves.toEqual({ ok: true });

    expect(client.query).toHaveBeenCalledWith('SELECT set_config($1, $2, true)', [
      'app.current_shop_id', shopId,
    ]);
    expect(queriedSql(client).some((s) => s.includes('UPDATE customers SET phone'))).toBe(true);
  });
});
