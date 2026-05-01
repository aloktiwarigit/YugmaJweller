import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { computeProductPrice } from '@goldsmith/money';

const NOW = new Date('2026-04-30T10:00:00.000Z');

const fakeRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: NOW },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: NOW },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: NOW },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: NOW },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: NOW },
  SILVER_999: { perGramPaise: 9500n, fetchedAt: NOW },
  SILVER_925: { perGramPaise: 8788n, fetchedAt: NOW },
  stale: false,
  source: 'ibja',
};

const mockPricingService = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };

function makePool(responses: Array<{ rows: object[] }>) {
  let callIdx = 0;
  return { query: vi.fn().mockImplementation(() => Promise.resolve(responses[callIdx++] ?? { rows: [] })) };
}

describe('CatalogService.getTenantConfig()', () => {
  it('returns config for an active shop with null config JSONB (uses defaults)', async () => {
    const pool = makePool([
      { rows: [{ id: 'shop-1', slug: 'test-shop', display_name: 'Test Jewellers', logo_url: null, config: null }] },
    ]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    const result = await svc.getTenantConfig('test-shop');

    expect(result).toEqual({
      shopId:          'shop-1',
      primaryColor:    '#B58A3C',
      logoUrl:         null,
      appName:         'Test Jewellers',
      defaultLanguage: 'hi',
    });
  });

  it('uses primaryColor and defaultLanguage from config JSONB when present', async () => {
    const pool = makePool([
      { rows: [{ id: 'shop-1', slug: 'gold-shop', display_name: 'Gold Shop', logo_url: 'https://cdn.example.com/logo.png', config: { primaryColor: '#FF0000', defaultLanguage: 'en' } }] },
    ]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    const result = await svc.getTenantConfig('gold-shop');

    expect(result.shopId).toBe('shop-1');
    expect(result.primaryColor).toBe('#FF0000');
    expect(result.defaultLanguage).toBe('en');
    expect(result.logoUrl).toBe('https://cdn.example.com/logo.png');
  });

  it('throws NotFoundException when shop slug not found', async () => {
    const pool = makePool([{ rows: [] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    await expect(svc.getTenantConfig('nonexistent')).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// Shared fixture for getProducts / getProduct
// ---------------------------------------------------------------------------

const baseProduct = {
  id: 'prod-1', sku: 'GLD-001', metal: 'GOLD', purity: 'GOLD_22K',
  category_id: 'cat-1', category_name: 'RINGS',
  gross_weight_g: '5.0000', net_weight_g: '4.5000',
  making_charge_override_pct: null,
  huid: 'HU123456', huid_exemption_category: 'none',
  quantity: 2, published_at: NOW, total_count: '1',
};

// ---------------------------------------------------------------------------
// getProducts
// ---------------------------------------------------------------------------

describe('CatalogService.getProducts()', () => {
  it('returns priceAvailable=true with computed price for known purity', async () => {
    const pool = makePool([
      { rows: [] },              // shop_settings (missing → defaults)
      { rows: [baseProduct] },   // products query
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].priceAvailable).toBe(true);
    expect(result.items[0].estimatedPrice?.totalFormatted).toMatch(/^₹/);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('returns priceAvailable=false for unknown purity', async () => {
    const pool = makePool([
      { rows: [] },
      { rows: [{ ...baseProduct, purity: 'PLATINUM_950', total_count: '1' }] },
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });

    expect(result.items[0].priceAvailable).toBe(false);
    expect(result.items[0].estimatedPrice).toBeUndefined();
  });

  it('returns priceAvailable=false for zero net_weight_g', async () => {
    const pool = makePool([
      { rows: [] },
      { rows: [{ ...baseProduct, net_weight_g: '0.0000', total_count: '1' }] },
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });

    expect(result.items[0].priceAvailable).toBe(false);
  });

  it('uses shop making charges over defaults when present', async () => {
    const customMc = [{ category: 'RINGS', type: 'percent', value: '20.00' }];
    const pool = makePool([
      { rows: [{ making_charges_json: customMc }] },
      { rows: [baseProduct] },
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });

    const withCustom = computeProductPrice({
      netWeightG: '4.5000', ratePerGramPaise: 673750n,
      makingChargePct: '20.00', stoneChargesPaise: 0n, hallmarkFeePaise: 0n,
    });
    expect(BigInt(result.items[0].estimatedPrice!.totalPaise)).toBe(withCustom.totalPaise);
  });

  it('falls back to 12.00% when no making charge matches category', async () => {
    const pool = makePool([
      { rows: [] },
      { rows: [{ ...baseProduct, category_name: 'UNKNOWN_CATEGORY', total_count: '1' }] },
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });

    expect(result.items[0].priceAvailable).toBe(true);
    const expected = computeProductPrice({
      netWeightG: '4.5000', ratePerGramPaise: 673750n,
      makingChargePct: '12.00', stoneChargesPaise: 0n, hallmarkFeePaise: 0n,
    });
    expect(BigInt(result.items[0].estimatedPrice!.totalPaise)).toBe(expected.totalPaise);
  });

  it('returns empty items and total=0 when no products', async () => {
    const pool = makePool([
      { rows: [] },
      { rows: [] },
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('appends metal filter to SQL when metal param provided', async () => {
    const pool = makePool([
      { rows: [] },
      { rows: [baseProduct] },
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    await svc.getProducts({ shopId: 'shop-1', metal: 'gold', page: 1, limit: 12 });

    const sqlCall = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(sqlCall[0]).toContain('p.metal = $');
    expect(sqlCall[1]).toContain('GOLD');
  });
});

// ---------------------------------------------------------------------------
// getProduct
// ---------------------------------------------------------------------------

describe('CatalogService.getProduct()', () => {
  it('returns product detail with computed price', async () => {
    const pool = makePool([
      { rows: [] },            // shop_settings
      { rows: [baseProduct] }, // product
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProduct('prod-1', 'shop-1');

    expect(result.id).toBe('prod-1');
    expect(result.huid).toBe('HU123456');
    expect(result.priceAvailable).toBe(true);
    expect(result.estimatedPrice?.totalFormatted).toMatch(/^₹/);
  });

  it('throws NotFoundException when product not found', async () => {
    const pool = makePool([
      { rows: [] }, // shop_settings
      { rows: [] }, // product not found
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    await expect(svc.getProduct('nonexistent', 'shop-1')).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// verifyHuid
// ---------------------------------------------------------------------------

describe('CatalogService.verifyHuid()', () => {
  const PRODUCT_ID = 'prod-uuid-1';
  const SHOP_ID    = 'shop-1';

  it('returns verified=true when QR HUID matches product HUID (raw 6-char)', async () => {
    const pool = makePool([{ rows: [{ huid: 'AB1234' }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'AB1234');

    expect(result.verified).toBe(true);
    expect(result.huid).toBe('AB1234');
    expect(result.certifyingBody).toBe('BIS');
  });

  it('returns verified=true for BIS URL format QR', async () => {
    const pool = makePool([{ rows: [{ huid: 'AB1234' }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'https://jewel.bis.gov.in/?huid=AB1234');

    expect(result.verified).toBe(true);
    expect(result.huid).toBe('AB1234');
    expect(result.certifyingBody).toBe('BIS');
  });

  it('returns verified=true for path-style QR', async () => {
    const pool = makePool([{ rows: [{ huid: 'ZZ9999' }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'https://bis.gov.in/huid/ZZ9999');

    expect(result.verified).toBe(true);
    expect(result.huid).toBe('ZZ9999');
  });

  it('returns verified=false when QR HUID does not match product HUID', async () => {
    const pool = makePool([{ rows: [{ huid: 'AB1234' }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'ZZ9999');

    expect(result.verified).toBe(false);
    expect(result.huid).toBe('ZZ9999');
  });

  it('returns verified=false when product has no HUID', async () => {
    const pool = makePool([{ rows: [{ huid: null }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'AB1234');

    expect(result.verified).toBe(false);
  });

  it('is case-insensitive for HUID comparison', async () => {
    const pool = makePool([{ rows: [{ huid: 'ab1234' }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'AB1234');

    expect(result.verified).toBe(true);
  });

  it('throws BadRequestException for unparseable QR payload', async () => {
    const pool = makePool([]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    const { BadRequestException } = await import('@nestjs/common');
    await expect(svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'not-a-valid-huid-string!!!')).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when product not found', async () => {
    const pool = makePool([{ rows: [] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    await expect(svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'AB1234')).rejects.toThrow(NotFoundException);
  });
});
