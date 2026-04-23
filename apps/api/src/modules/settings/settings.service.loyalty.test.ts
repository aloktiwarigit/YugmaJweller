import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LoyaltyConfig } from '@goldsmith/shared';
import type { Pool } from 'pg';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Tenant, AuthenticatedTenantContext } from '@goldsmith/tenant-context';

// Mock audit module before importing SettingsService
vi.mock('@goldsmith/audit', async (importOriginal) => {
  const original = await importOriginal<typeof import('@goldsmith/audit')>();
  return {
    ...original,
    auditLog: vi.fn().mockResolvedValue(undefined),
  };
});

import { SettingsService } from './settings.service';
import type { SettingsRepository } from './settings.repository';
import type { SettingsCache } from '@goldsmith/tenant-config';
import type { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';

// ---------------------------------------------------------------------------
// Minimal mocks — cast to typed interfaces via `unknown`
// ---------------------------------------------------------------------------

type MockFn = ReturnType<typeof vi.fn>;

const mockRepo = {
  getShopProfile: vi.fn(),
  updateShopProfile: vi.fn(),
  getLoyalty: vi.fn(),
  upsertLoyalty: vi.fn(),
} as unknown as SettingsRepository;

const mockCache = {
  getProfile: vi.fn(),
  setProfile: vi.fn(),
  invalidate: vi.fn(),
  getLoyalty: vi.fn(),
  setLoyalty: vi.fn(),
  invalidateLoyalty: vi.fn(),
} as unknown as SettingsCache;

const mockPool = {} as Pool;

const mockTenantLookup = {
  invalidate: vi.fn(),
} as unknown as DrizzleTenantLookup;

const mockFlagsCache = {
  getFlags: vi.fn().mockResolvedValue(null),
  setFlags: vi.fn().mockResolvedValue(undefined),
  invalidate: vi.fn().mockResolvedValue(undefined),
} as never;

function makeService(): SettingsService {
  return new SettingsService(mockRepo, mockCache, mockFlagsCache, mockTenantLookup, mockPool);
}

// Helpers to call vitest mock API on typed stubs
const cacheGetLoyalty        = (): MockFn => (mockCache.getLoyalty        as unknown as MockFn);
const cacheSetLoyalty        = (): MockFn => (mockCache.setLoyalty        as unknown as MockFn);
const cacheInvalidateLoyalty = (): MockFn => (mockCache.invalidateLoyalty as unknown as MockFn);
const repoGetLoyalty         = (): MockFn => (mockRepo.getLoyalty         as unknown as MockFn);
const repoUpsertLoyalty      = (): MockFn => (mockRepo.upsertLoyalty      as unknown as MockFn);

const SHOP_ID = 'shop-uuid-001';
const tenant: Tenant = { id: SHOP_ID, slug: 'test', display_name: 'Test Jewellers', status: 'ACTIVE' };
const ctx: AuthenticatedTenantContext = {
  shopId: SHOP_ID, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
};

const DEFAULT_CONFIG: LoyaltyConfig = {
  tiers: [
    { name: 'Silver',  thresholdPaise: 5_000_000,  badgeColor: '#C0C0C0' },
    { name: 'Gold',    thresholdPaise: 15_000_000, badgeColor: '#FFD700' },
    { name: 'Diamond', thresholdPaise: 50_000_000, badgeColor: '#B9F2FF' },
  ],
  earnRatePercentage: '1.00',
  redemptionRatePercentage: '1.00',
};

// ---------------------------------------------------------------------------
// getLoyalty
// ---------------------------------------------------------------------------

describe('SettingsService.getLoyalty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached value on cache hit', async () => {
    cacheGetLoyalty().mockResolvedValueOnce(DEFAULT_CONFIG);

    const svc = makeService();
    const result = await tenantContext.runWith(ctx, () => svc.getLoyalty());

    expect(result).toEqual(DEFAULT_CONFIG);
    expect(repoGetLoyalty()).not.toHaveBeenCalled();
    expect(cacheSetLoyalty()).not.toHaveBeenCalled();
  });

  it('fetches from repo and populates cache on miss', async () => {
    cacheGetLoyalty().mockResolvedValueOnce(null);
    repoGetLoyalty().mockResolvedValueOnce(DEFAULT_CONFIG);
    cacheSetLoyalty().mockResolvedValueOnce(undefined);

    const svc = makeService();
    const result = await tenantContext.runWith(ctx, () => svc.getLoyalty());

    expect(result).toEqual(DEFAULT_CONFIG);
    expect(repoGetLoyalty()).toHaveBeenCalledWith();
    expect(cacheSetLoyalty()).toHaveBeenCalledWith(DEFAULT_CONFIG);
  });
});

// ---------------------------------------------------------------------------
// updateLoyalty
// ---------------------------------------------------------------------------

describe('SettingsService.updateLoyalty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('type=tier updates the correct tier and returns ok:true', async () => {
    cacheGetLoyalty().mockResolvedValueOnce(DEFAULT_CONFIG);
    repoUpsertLoyalty().mockResolvedValueOnce(undefined);
    cacheInvalidateLoyalty().mockResolvedValueOnce(undefined);

    const svc = makeService();
    const result = await tenantContext.runWith(ctx, () => svc.updateLoyalty({
      type: 'tier',
      index: 0,
      name: 'Bronze',
      thresholdRupees: '100.00', // 10000 paise
      badgeColor: '#CD7F32',
    }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.tiers[0].name).toBe('Bronze');
      expect(result.config.tiers[0].thresholdPaise).toBe(10000);
      expect(result.config.tiers[0].badgeColor).toBe('#CD7F32');
      // other tiers unchanged
      expect(result.config.tiers[1].name).toBe('Gold');
      expect(result.config.tiers[2].name).toBe('Diamond');
    }
    expect(repoUpsertLoyalty()).toHaveBeenCalledOnce();
    expect(cacheInvalidateLoyalty()).toHaveBeenCalledOnce();
  });

  it('type=tier returns TIER_ORDER_INVALID when tier[0] >= tier[1]', async () => {
    cacheGetLoyalty().mockResolvedValueOnce(DEFAULT_CONFIG);

    const svc = makeService();
    // Set tier[0] threshold to same as tier[1] — violates ordering
    const result = await tenantContext.runWith(ctx, () => svc.updateLoyalty({
      type: 'tier',
      index: 0,
      name: 'Silver',
      thresholdRupees: '150000.00', // 15_000_000 paise — same as Gold
      badgeColor: '#C0C0C0',
    }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('TIER_ORDER_INVALID');
    }
    expect(repoUpsertLoyalty()).not.toHaveBeenCalled();
  });

  it('type=tier returns TIER_ORDER_INVALID when tier[1] >= tier[2]', async () => {
    cacheGetLoyalty().mockResolvedValueOnce(DEFAULT_CONFIG);

    const svc = makeService();
    // Bump tier[1] above tier[2]
    const result = await tenantContext.runWith(ctx, () => svc.updateLoyalty({
      type: 'tier',
      index: 1,
      name: 'Gold',
      thresholdRupees: '600000.00', // 60_000_000 paise — above Diamond's 50_000_000
      badgeColor: '#FFD700',
    }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('TIER_ORDER_INVALID');
    }
    expect(repoUpsertLoyalty()).not.toHaveBeenCalled();
  });

  it('type=rate updates earn and redemption rates and returns ok:true', async () => {
    cacheGetLoyalty().mockResolvedValueOnce(DEFAULT_CONFIG);
    repoUpsertLoyalty().mockResolvedValueOnce(undefined);
    cacheInvalidateLoyalty().mockResolvedValueOnce(undefined);

    const svc = makeService();
    const result = await tenantContext.runWith(ctx, () => svc.updateLoyalty({
      type: 'rate',
      earnRatePercentage: '2.50',
      redemptionRatePercentage: '1.50',
    }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.earnRatePercentage).toBe('2.50');
      expect(result.config.redemptionRatePercentage).toBe('1.50');
    }
    expect(repoUpsertLoyalty()).toHaveBeenCalledOnce();
    expect(cacheInvalidateLoyalty()).toHaveBeenCalledOnce();
  });

  it('type=rate returns TIER_ORDER_INVALID when stored tiers are already out-of-order', async () => {
    // Fix 2: isAscendingOrder is now called on both branches
    const outOfOrderConfig: LoyaltyConfig = {
      ...DEFAULT_CONFIG,
      tiers: [
        { name: 'Silver',  thresholdPaise: 50_000_000, badgeColor: '#C0C0C0' }, // higher than Gold
        { name: 'Gold',    thresholdPaise: 15_000_000, badgeColor: '#FFD700' },
        { name: 'Diamond', thresholdPaise: 50_000_000, badgeColor: '#B9F2FF' },
      ],
    };
    cacheGetLoyalty().mockResolvedValueOnce(outOfOrderConfig);

    const svc = makeService();
    const result = await tenantContext.runWith(ctx, () => svc.updateLoyalty({
      type: 'rate',
      earnRatePercentage: '2.00',
      redemptionRatePercentage: '1.00',
    }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('TIER_ORDER_INVALID');
    }
    expect(repoUpsertLoyalty()).not.toHaveBeenCalled();
  });

  it('invalidates cache after successful upsert', async () => {
    cacheGetLoyalty().mockResolvedValueOnce(DEFAULT_CONFIG);
    repoUpsertLoyalty().mockResolvedValueOnce(undefined);
    cacheInvalidateLoyalty().mockResolvedValueOnce(undefined);

    const svc = makeService();
    const result = await tenantContext.runWith(ctx, () => svc.updateLoyalty({
      type: 'rate',
      earnRatePercentage: '1.50',
      redemptionRatePercentage: '0.75',
    }));

    expect(result.ok).toBe(true);
    expect(cacheInvalidateLoyalty()).toHaveBeenCalledOnce();
  });

  it('fires audit log fire-and-forget and does not await it', async () => {
    const { auditLog } = await import('@goldsmith/audit');
    const auditLogMock = auditLog as ReturnType<typeof vi.fn>;
    // Make audit resolution slow — the function should still return without waiting
    let resolveAudit!: () => void;
    auditLogMock.mockReturnValueOnce(new Promise<void>((res) => { resolveAudit = res; }));

    cacheGetLoyalty().mockResolvedValueOnce(DEFAULT_CONFIG);
    repoUpsertLoyalty().mockResolvedValueOnce(undefined);
    cacheInvalidateLoyalty().mockResolvedValueOnce(undefined);

    const svc = makeService();
    const result = await tenantContext.runWith(ctx, () => svc.updateLoyalty({
      type: 'rate',
      earnRatePercentage: '1.25',
      redemptionRatePercentage: '0.50',
    }));

    // Should resolve even though audit promise hasn't settled
    expect(result.ok).toBe(true);
    // Audit was called with before/after in metadata
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({ before: DEFAULT_CONFIG }),
      }),
    );
    // Settle the deferred audit to avoid unhandled rejection
    resolveAudit();
  });
});
