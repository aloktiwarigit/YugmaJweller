import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryValuationService } from './inventory.valuation.service';
import type { ValuationProductRow } from './inventory.repository';
import type { CurrentRatesResult } from '../pricing/pricing.service';
import type { AuthenticatedTenantContext, Tenant } from '@goldsmith/tenant-context';

const SHOP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ctx: AuthenticatedTenantContext = {
  shopId: SHOP_ID, userId: 'u1', role: 'shop_admin', authenticated: true,
  tenant: { id: SHOP_ID, slug: 'shop-a', display_name: 'Shop A', status: 'ACTIVE' } as Tenant,
};

const RATE_22K = 600_000n; // ₹6,000.00 per gram
const FRESH_AT = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago — not stale

const mockRates: CurrentRatesResult = {
  GOLD_24K: { perGramPaise: 650_000n, fetchedAt: FRESH_AT },
  GOLD_22K: { perGramPaise: RATE_22K, fetchedAt: FRESH_AT },
  GOLD_20K: { perGramPaise: 550_000n, fetchedAt: FRESH_AT },
  GOLD_18K: { perGramPaise: 480_000n, fetchedAt: FRESH_AT },
  GOLD_14K: { perGramPaise: 380_000n, fetchedAt: FRESH_AT },
  SILVER_999: { perGramPaise: 10_000n, fetchedAt: FRESH_AT },
  SILVER_925: { perGramPaise: 9_200n, fetchedAt: FRESH_AT },
  stale: false,
  source: 'ibja',
};

// 9g net at 22K ₹6,000/g = 5,400,000 paise
const ring22K: ValuationProductRow = {
  id: 'prod-1', metal: 'GOLD', purity: '22K', net_weight_g: '9.0000',
  making_charge_override_pct: null, category_id: 'cat-1', category_name: 'अंगूठी',
};

describe('InventoryValuationService', () => {
  let service: InventoryValuationService;
  let repoMock: { listProductsForValuation: ReturnType<typeof vi.fn> };
  let pricingMock: { getCurrentRates: ReturnType<typeof vi.fn> };
  let redisMock: { get: ReturnType<typeof vi.fn>; setex: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repoMock = { listProductsForValuation: vi.fn().mockResolvedValue([ring22K]) };
    pricingMock = { getCurrentRates: vi.fn().mockResolvedValue(mockRates) };
    redisMock = { get: vi.fn().mockResolvedValue(null), setex: vi.fn().mockResolvedValue('OK') };
    service = new InventoryValuationService(
      repoMock as never,
      pricingMock as never,
      redisMock as never,
    );
  });

  it('computes correct paise for a 22K product at 9g', async () => {
    const summary = await service.computeValuation(ctx);
    // 9g × 600,000 paise/g = 5,400,000 paise
    expect(summary.grandTotalPaise).toBe(5_400_000n);
    expect(summary.categories).toHaveLength(1);
    expect(summary.categories[0]?.category).toBe('अंगूठी');
    expect(summary.categories[0]?.productCount).toBe(1);
    expect(summary.categories[0]?.marketValuePaise).toBe(5_400_000n);
  });

  it('returns empty summary when repo returns no products', async () => {
    repoMock.listProductsForValuation.mockResolvedValue([]);
    const summary = await service.computeValuation(ctx);
    expect(summary.grandTotalPaise).toBe(0n);
    expect(summary.categories).toHaveLength(0);
  });

  it('skips and logs products with unknown purity', async () => {
    const ptProduct: ValuationProductRow = {
      ...ring22K, id: 'prod-pt', purity: 'PT950',
    };
    repoMock.listProductsForValuation.mockResolvedValue([ptProduct]);
    const warnSpy = vi.spyOn(service['logger'], 'warn');
    const summary = await service.computeValuation(ctx);
    expect(summary.grandTotalPaise).toBe(0n);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('PT950'));
  });

  it('sets ratesStale=true when fetchedAt is older than 30 minutes', async () => {
    const staleRates: CurrentRatesResult = {
      ...mockRates,
      GOLD_22K: { perGramPaise: RATE_22K, fetchedAt: new Date(Date.now() - 31 * 60 * 1000) },
    };
    pricingMock.getCurrentRates.mockResolvedValue(staleRates);
    const summary = await service.computeValuation(ctx);
    expect(summary.ratesStale).toBe(true);
  });

  it('sets ratesStale=false when fetchedAt is within 30 minutes', async () => {
    const summary = await service.computeValuation(ctx);
    expect(summary.ratesStale).toBe(false);
  });

  it('returns cached result and skips getCurrentRates on cache hit', async () => {
    // First call — computes and caches
    const first = await service.computeValuation(ctx);
    // Simulate cache hit on next call
    const cachedPayload = JSON.stringify({
      ...first,
      grandTotalPaise: first.grandTotalPaise.toString(),
      ratesFreshAt: first.ratesFreshAt.toISOString(),
      computedAt: first.computedAt.toISOString(),
      categories: first.categories.map((c) => ({
        ...c, marketValuePaise: c.marketValuePaise.toString(),
      })),
    });
    redisMock.get.mockResolvedValue(cachedPayload);
    const second = await service.computeValuation(ctx);
    // getCurrentRates was only called once (for the first call)
    expect(pricingMock.getCurrentRates).toHaveBeenCalledTimes(1);
    expect(second.grandTotalPaise).toBe(first.grandTotalPaise);
  });

  it('groups multiple products in the same category correctly', async () => {
    const ring2: ValuationProductRow = {
      ...ring22K, id: 'prod-2', net_weight_g: '6.0000',
    };
    repoMock.listProductsForValuation.mockResolvedValue([ring22K, ring2]);
    const summary = await service.computeValuation(ctx);
    // (9 + 6) g × 600,000 = 9,000,000 paise
    expect(summary.grandTotalPaise).toBe(9_000_000n);
    expect(summary.categories).toHaveLength(1);
    expect(summary.categories[0]?.productCount).toBe(2);
  });
});
