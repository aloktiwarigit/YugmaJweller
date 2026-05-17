import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceUnavailableException, type ExecutionContext } from '@nestjs/common';
import {
  CustomerAuthGuard,
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
    expect(req.customerCtx).toEqual({ customerId: DEV_MOCK_CUSTOMER_ID, shopId: SHOP_ID });
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

    expect(verifyIdToken).toHaveBeenCalledWith('firebase-token', true);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(req.customerCtx).toBeUndefined();
  });

  it('allows an active shop on the Firebase path', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ phone_number: '+919876543210' });
    const pool = makePool();
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ status: 'ACTIVE' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: CUSTOMER_ID }] } as never);
    const req = makeRequest('Bearer firebase-token');
    const guard = new CustomerAuthGuard(makeFirebase(verifyIdToken), pool);

    await expect(guard.canActivate(makeExecutionContext(req))).resolves.toBe(true);

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      `SELECT id FROM customers WHERE phone = $1 AND shop_id = $2 AND deleted_at IS NULL LIMIT 1`,
      ['+919876543210', SHOP_ID],
    );
    expect(req.customerCtx).toEqual({ customerId: CUSTOMER_ID, shopId: SHOP_ID });
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
