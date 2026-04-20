import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsCache } from './settings-cache';
import type { LoyaltyConfig } from '@goldsmith/shared';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

const SHOP_A = '22222222-2222-2222-2222-222222222222';

const tenantA: Tenant = { id: SHOP_A, slug: 'anchor-dev', display_name: 'Rajesh Jewellers', status: 'ACTIVE' };
const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

const loyalty: LoyaltyConfig = {
  tiers: [
    { name: 'Silver',  thresholdPaise: 5_000_000,  badgeColor: '#C0C0C0' },
    { name: 'Gold',    thresholdPaise: 15_000_000, badgeColor: '#FFD700' },
    { name: 'Diamond', thresholdPaise: 50_000_000, badgeColor: '#B9F2FF' },
  ],
  earnRatePercentage:       '1.00',
  redemptionRatePercentage: '1.00',
};

describe('SettingsCache — loyalty methods', () => {
  let cache: SettingsCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new SettingsCache(mockRedis as never, 60);
  });

  it('getLoyalty returns null on cache miss', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    const result = await tenantContext.runWith(ctxA, () => cache.getLoyalty());
    expect(result).toBeNull();
    expect(mockRedis.get).toHaveBeenCalledWith(`shop:${SHOP_A}:settings:loyalty`);
  });

  it('getLoyalty returns parsed config on cache hit with valid JSON', async () => {
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(loyalty));
    const result = await tenantContext.runWith(ctxA, () => cache.getLoyalty());
    expect(result).toEqual(loyalty);
  });

  it('getLoyalty returns null when cached JSON fails LoyaltyConfigSchema parse', async () => {
    // Missing required fields — fails Zod
    mockRedis.get.mockResolvedValueOnce(JSON.stringify({ earnRatePercentage: '1.00' }));
    mockRedis.del.mockResolvedValueOnce(1);
    const result = await tenantContext.runWith(ctxA, () => cache.getLoyalty());
    expect(result).toBeNull();
    expect(mockRedis.del).toHaveBeenCalledWith(`shop:${SHOP_A}:settings:loyalty`);
  });

  it('setLoyalty stores JSON at correct key with 60 s TTL', async () => {
    mockRedis.set.mockResolvedValueOnce('OK');
    await tenantContext.runWith(ctxA, () => cache.setLoyalty(loyalty));
    expect(mockRedis.set).toHaveBeenCalledWith(
      `shop:${SHOP_A}:settings:loyalty`,
      JSON.stringify(loyalty),
      'EX',
      60,
    );
  });

  it('invalidateLoyalty deletes the key', async () => {
    mockRedis.del.mockResolvedValueOnce(1);
    await tenantContext.runWith(ctxA, () => cache.invalidateLoyalty());
    expect(mockRedis.del).toHaveBeenCalledWith(`shop:${SHOP_A}:settings:loyalty`);
  });
});
