import { describe, it, expect, vi } from 'vitest';
import { PermissionsRepository } from './permissions.repository';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Tenant, UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

const fakeTenant: Tenant = { id: 'shop-1', slug: 'sl', display_name: 'S', status: 'ACTIVE' };
const ctx: UnauthenticatedTenantContext = { shopId: 'shop-1', tenant: fakeTenant, authenticated: false };

function makePool(rows: Record<string, unknown>[]): import('pg').Pool {
  return {
    connect: vi.fn().mockResolvedValue({
      query: vi.fn()
        .mockResolvedValueOnce(undefined)         // SET ROLE app_user
        .mockResolvedValueOnce({ rows })           // SELECT role_permissions
        .mockResolvedValue(undefined),             // finally: POISON_UUID + RESET ROLE
      release: vi.fn(),
    }),
  } as unknown as import('pg').Pool;
}

describe('PermissionsRepository.getPermissions', () => {
  it('returns Record<key, boolean> for all rows', async () => {
    const rows = [
      { permission_key: 'billing.create', is_enabled: true },
      { permission_key: 'billing.void',   is_enabled: false },
    ];
    const repo = new PermissionsRepository(makePool(rows));
    let result: Record<string, boolean> | undefined;
    await tenantContext.runWith(ctx, async () => {
      result = await repo.getPermissions('shop-1', 'shop_manager');
    });
    expect(result).toEqual({ 'billing.create': true, 'billing.void': false });
  });

  it('returns empty record when no rows', async () => {
    const repo = new PermissionsRepository(makePool([]));
    let result: Record<string, boolean> | undefined;
    await tenantContext.runWith(ctx, async () => {
      result = await repo.getPermissions('shop-1', 'shop_manager');
    });
    expect(result).toEqual({});
  });
});
