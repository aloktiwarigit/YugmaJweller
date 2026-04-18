import { describe, it, expect } from 'vitest';
import RedisMock from 'ioredis-mock';
import { tenantContext } from '@goldsmith/tenant-context';
import { TenantScopedCache } from '../src/tenant-scoped-cache';

const A = { shopId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };
const B = { shopId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' };

describe('TenantScopedCache', () => {
  it('key-prefixes with shopId from ALS', async () => {
    const redis = new RedisMock();
    const cache = new TenantScopedCache(redis as never);
    await tenantContext.runWith(A as never, () => cache.set('k', 'vA'));
    await tenantContext.runWith(B as never, () => cache.set('k', 'vB'));
    expect(await tenantContext.runWith(A as never, () => cache.get('k'))).toBe('vA');
    expect(await tenantContext.runWith(B as never, () => cache.get('k'))).toBe('vB');
  });

  it('throws if no tenant ctx', async () => {
    const redis = new RedisMock();
    const cache = new TenantScopedCache(redis as never);
    await expect(cache.get('k')).rejects.toThrow(/tenant\.context_not_set/);
  });

  it('flushTenant removes only that tenant keys', async () => {
    const redis = new RedisMock();
    const cache = new TenantScopedCache(redis as never);
    await tenantContext.runWith(A as never, async () => { await cache.set('a1', '1'); await cache.set('a2', '2'); });
    await tenantContext.runWith(B as never, () => cache.set('b1', '1'));
    await cache.flushTenant(A.shopId);
    expect(await tenantContext.runWith(A as never, () => cache.get('a1'))).toBeNull();
    expect(await tenantContext.runWith(B as never, () => cache.get('b1'))).toBe('1');
  });
});
