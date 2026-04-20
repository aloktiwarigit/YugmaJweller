import { describe, it, expect, vi } from 'vitest';
import { AuthRepository } from './auth.repository';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Tenant } from '@goldsmith/tenant-context';

const fakeTenant: Tenant = { id: 'shop-1', slug: 'sl', display_name: 'My Shop', status: 'ACTIVE' };
const ctx = { shopId: 'shop-1', tenant: fakeTenant, authenticated: false } as const;

describe('AuthRepository.inviteStaff', () => {
  it('returns conflict:true when phone already in INVITED/ACTIVE status', async () => {
    // withTenantTx sequence: BEGIN → SET LOCAL ROLE app_user → SET LOCAL app.current_shop_id
    //   → conflict SELECT (1 row) → COMMIT → SET app.current_shop_id=POISON → release
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)                                      // BEGIN
        .mockResolvedValueOnce(undefined)                                      // SET LOCAL ROLE app_user
        .mockResolvedValueOnce(undefined)                                      // SET LOCAL app.current_shop_id
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 })   // conflict SELECT
        .mockResolvedValueOnce(undefined)                                      // COMMIT
        .mockResolvedValueOnce(undefined),                                     // SET app.current_shop_id=POISON (finally)
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as import('pg').Pool;
    const repo = new AuthRepository(pool);
    let result: { conflict: boolean } | undefined;
    await tenantContext.runWith(ctx, async () => {
      result = await repo.inviteStaff({
        phone: '+919000001234', role: 'shop_staff', displayName: 'Alice',
        invitedByUserId: 'owner-id', shopId: 'shop-1', tenant: fakeTenant,
      });
    });
    expect(result?.conflict).toBe(true);
  });

  it('returns conflict:false and userId on successful insert', async () => {
    // withTenantTx sequence: BEGIN → SET LOCAL ROLE app_user → SET LOCAL app.current_shop_id
    //   → no-conflict SELECT (0 rows) → INSERT → COMMIT → SET app.current_shop_id=POISON
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)                                      // BEGIN
        .mockResolvedValueOnce(undefined)                                      // SET LOCAL ROLE app_user
        .mockResolvedValueOnce(undefined)                                      // SET LOCAL app.current_shop_id
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })                      // no conflict
        .mockResolvedValueOnce({ rows: [{ id: 'new-user-id' }], rowCount: 1 }) // INSERT
        .mockResolvedValueOnce(undefined)                                      // COMMIT
        .mockResolvedValueOnce(undefined),                                     // SET app.current_shop_id=POISON (finally)
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as import('pg').Pool;
    const repo = new AuthRepository(pool);
    let result: { conflict: boolean; userId?: string } | undefined;
    await tenantContext.runWith(ctx, async () => {
      result = await repo.inviteStaff({
        phone: '+919000005678', role: 'shop_manager', displayName: 'Bob',
        invitedByUserId: 'owner-id', shopId: 'shop-1', tenant: fakeTenant,
      });
    });
    expect(result?.conflict).toBe(false);
    expect(result?.userId).toBe('new-user-id');
  });
});

describe('AuthRepository.listUsers', () => {
  it('returns mapped user rows', async () => {
    const rows = [{
      id: 'u1', display_name: 'Alice', role: 'shop_staff',
      status: 'ACTIVE', phone: '+919000001111', invited_at: null, activated_at: null,
    }];
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)   // SET ROLE app_user
        .mockResolvedValueOnce({ rows })
        .mockResolvedValueOnce(undefined)   // POISON
        .mockResolvedValueOnce(undefined),  // RESET ROLE
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(mockClient) } as unknown as import('pg').Pool;
    const repo = new AuthRepository(pool);
    let result: unknown;
    await tenantContext.runWith(ctx, async () => {
      result = await repo.listUsers('shop-1');
    });
    expect(Array.isArray(result)).toBe(true);
    expect((result as { id: string }[])[0]?.id).toBe('u1');
  });
});
