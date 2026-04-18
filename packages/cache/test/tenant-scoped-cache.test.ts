import { describe, it, expect } from 'vitest';
import RedisMock from 'ioredis-mock';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
import { TenantScopedCache } from '../src/tenant-scoped-cache';

const tenantA: Tenant = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', slug: 'a', display_name: 'A', status: 'ACTIVE' };
const tenantB: Tenant = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', slug: 'b', display_name: 'B', status: 'ACTIVE' };
const A: UnauthenticatedTenantContext = { shopId: tenantA.id, tenant: tenantA, authenticated: false };
const B: UnauthenticatedTenantContext = { shopId: tenantB.id, tenant: tenantB, authenticated: false };

describe('TenantScopedCache', () => {
  it('key-prefixes with shopId from ALS', async () => {
    const redis = new RedisMock();
    const cache = new TenantScopedCache(redis as never);
    await tenantContext.runWith(A, () => cache.set('k', 'vA'));
    await tenantContext.runWith(B, () => cache.set('k', 'vB'));
    expect(await tenantContext.runWith(A, () => cache.get('k'))).toBe('vA');
    expect(await tenantContext.runWith(B, () => cache.get('k'))).toBe('vB');
  });

  it('throws if no tenant ctx', async () => {
    const redis = new RedisMock();
    const cache = new TenantScopedCache(redis as never);
    await expect(cache.get('k')).rejects.toThrow(/tenant\.context_not_set/);
  });

  it('flushTenant removes only that tenant keys', async () => {
    const redis = new RedisMock();
    const cache = new TenantScopedCache(redis as never);
    await tenantContext.runWith(A, async () => { await cache.set('a1', '1'); await cache.set('a2', '2'); });
    await tenantContext.runWith(B, () => cache.set('b1', '1'));
    await cache.flushTenant(A.shopId);
    expect(await tenantContext.runWith(A, () => cache.get('a1'))).toBeNull();
    expect(await tenantContext.runWith(B, () => cache.get('b1'))).toBe('1');
  });
});
