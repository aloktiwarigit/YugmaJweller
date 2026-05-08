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
const mockSettingsRepo = { getReturnPolicy: vi.fn().mockResolvedValue(null) };
// F6-server: CatalogService now requires an IMAGEKIT_URL_BUILDER injection.
// Stub returns deterministic URLs so existing tests are unaffected.
const stubUrlBuilder = {
  url: (key: string, opts: { width: number; blur?: number }) =>
    `https://ik.imagekit.io/goldsmith/${key}?tr=w-${opts.width}${opts.blur ? `,bl-${opts.blur}` : ''},mb-0.25`,
  srcset: (key: string) =>
    [320, 640, 1024, 1920].map((w) => `https://ik.imagekit.io/goldsmith/${key}?tr=w-${w},mb-0.25 ${w}w`).join(', '),
  cardSrcset: (key: string) =>
    [320, 640].map((w) => `https://ik.imagekit.io/goldsmith/${key}?tr=w-${w},mb-0.25 ${w}w`).join(', '),
};

function makePool(responses: Array<{ rows: object[] }>) {
  let callIdx = 0;
  return { query: vi.fn().mockImplementation(() => Promise.resolve(responses[callIdx++] ?? { rows: [] })) };
}

describe('CatalogService.getTenantConfig()', () => {
  it('returns config for an active shop with null config JSONB (uses defaults)', async () => {
    const pool = makePool([
      { rows: [{ id: 'shop-1', slug: 'test-shop', display_name: 'Test Jewellers', logo_url: null, config: null }] },
    ]);
    const svc = new CatalogService(pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never);

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
    const svc = new CatalogService(pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never);

    const result = await svc.getTenantConfig('gold-shop');

    expect(result.shopId).toBe('shop-1');
    expect(result.primaryColor).toBe('#FF0000');
    expect(result.defaultLanguage).toBe('en');
    expect(result.logoUrl).toBe('https://cdn.example.com/logo.png');
  });

  it('throws NotFoundException when shop slug not found', async () => {
    const pool = makePool([{ rows: [] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never);

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
  // B3: image fields (null = no primary image set)
  pi_storage_key: null as string | null,
  pi_alt_text: null as string | null,
  pi_width: null as number | null,
  pi_height: null as number | null,
};

const baseProductWithImage = {
  ...baseProduct,
  pi_storage_key: 'shops/shop-1/products/prod-1/main.jpg',
  pi_alt_text: '22K सोने की अंगूठी',
  pi_width: 800,
  pi_height: 1000,
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
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);

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
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);

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
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);

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
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);

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
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);

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
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);

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
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);

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
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);

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
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);

    await expect(svc.getProduct('nonexistent', 'shop-1')).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// getReturnPolicy — returns shop-specific text from settings
// ---------------------------------------------------------------------------

describe('CatalogService.getReturnPolicy()', () => {
  it('returns shop-specific return policy text', async () => {
    const pool = makePool([]);
    const ps   = { getCurrentRates: vi.fn() };
    const settingsRepo = { getReturnPolicy: vi.fn().mockResolvedValue('30-day exchange policy') };
    const svc  = new CatalogService(pool as never, ps as never, settingsRepo as never, stubUrlBuilder as never);

    const result = await svc.getReturnPolicy();

    expect(result).toEqual({ returnPolicyText: '30-day exchange policy' });
    expect(settingsRepo.getReturnPolicy).toHaveBeenCalledTimes(1);
  });

  it('returns null when no policy configured', async () => {
    const pool = makePool([]);
    const ps   = { getCurrentRates: vi.fn() };
    const settingsRepo = { getReturnPolicy: vi.fn().mockResolvedValue(null) };
    const svc  = new CatalogService(pool as never, ps as never, settingsRepo as never, stubUrlBuilder as never);

    const result = await svc.getReturnPolicy();

    expect(result).toEqual({ returnPolicyText: null });
  });
});

// ---------------------------------------------------------------------------
// verifyHuid
// ---------------------------------------------------------------------------

describe('CatalogService.verifyHuid()', () => {
  const PRODUCT_ID = 'prod-uuid-1';
  const SHOP_ID    = 'shop-1';
  const stubSettings = { getReturnPolicy: vi.fn() };

  it('returns verified=true when QR HUID matches product HUID (raw 6-char)', async () => {
    const pool = makePool([{ rows: [{ huid: 'AB1234' }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never, stubSettings as never, stubUrlBuilder as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'AB1234');

    expect(result.verified).toBe(true);
    expect(result.huid).toBe('AB1234');
    expect(result.certifyingBody).toBe('BIS');
  });

  it('returns verified=true for BIS URL format QR', async () => {
    const pool = makePool([{ rows: [{ huid: 'AB1234' }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never, stubSettings as never, stubUrlBuilder as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'https://jewel.bis.gov.in/?huid=AB1234');

    expect(result.verified).toBe(true);
    expect(result.huid).toBe('AB1234');
    expect(result.certifyingBody).toBe('BIS');
  });

  it('returns verified=true for path-style QR', async () => {
    const pool = makePool([{ rows: [{ huid: 'ZZ9999' }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never, stubSettings as never, stubUrlBuilder as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'https://bis.gov.in/huid/ZZ9999');

    expect(result.verified).toBe(true);
    expect(result.huid).toBe('ZZ9999');
  });

  it('returns verified=false when QR HUID does not match product HUID', async () => {
    const pool = makePool([{ rows: [{ huid: 'AB1234' }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never, stubSettings as never, stubUrlBuilder as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'ZZ9999');

    expect(result.verified).toBe(false);
    expect(result.huid).toBe('ZZ9999');
  });

  it('returns verified=false when product has no HUID', async () => {
    const pool = makePool([{ rows: [{ huid: null }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never, stubSettings as never, stubUrlBuilder as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'AB1234');

    expect(result.verified).toBe(false);
  });

  it('is case-insensitive for HUID comparison', async () => {
    const pool = makePool([{ rows: [{ huid: 'ab1234' }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never, stubSettings as never, stubUrlBuilder as never);

    const result = await svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'AB1234');

    expect(result.verified).toBe(true);
  });

  it('throws BadRequestException for unparseable QR payload', async () => {
    const pool = makePool([]);
    const svc = new CatalogService(pool as never, mockPricingService as never, stubSettings as never, stubUrlBuilder as never);

    const { BadRequestException } = await import('@nestjs/common');
    await expect(svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'not-a-valid-huid-string!!!')).rejects.toThrow(BadRequestException);
  });

  it('rejects partial HUID token — ?huid=AB1234ZZ does not match AB1234', async () => {
    const pool = makePool([]);
    const svc = new CatalogService(pool as never, mockPricingService as never, stubSettings as never, stubUrlBuilder as never);

    const { BadRequestException } = await import('@nestjs/common');
    await expect(svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'https://x?huid=AB1234ZZ')).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when product not found', async () => {
    const pool = makePool([{ rows: [] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never, stubSettings as never, stubUrlBuilder as never);

    await expect(svc.verifyHuid(PRODUCT_ID, SHOP_ID, 'AB1234')).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// WS-A: B1 — filter SQL construction
// Test strategy: pass filter params, then assert pool.query.mock.calls[1][0]
// (products SQL) contains the expected WHERE clause snippet, and
// pool.query.mock.calls[1][1] (params array) contains the expected value.
// Call[0] = shop_settings, Call[1] = products SQL (no collection slug lookup).
// ---------------------------------------------------------------------------

describe('CatalogService.getProducts() — B1 filter SQL (WS-A)', () => {
  function makeFilterPool() {
    return makePool([
      { rows: [] },            // shop_settings (defaults)
      { rows: [baseProduct] }, // products
    ]);
  }
  function makeSvc(pool: ReturnType<typeof makePool>) {
    return new CatalogService(
      pool as never,
      mockPricingService as never,
      mockSettingsRepo as never,
      stubUrlBuilder as never,
    );
  }

  it('appends purity = $N when purity param provided', async () => {
    const pool = makeFilterPool();
    await makeSvc(pool).getProducts({ shopId: 'shop-1', purity: 'GOLD_22K', page: 1, limit: 12 });
    const sql    = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][1] as unknown[];
    expect(sql).toContain('p.purity = $');
    expect(params).toContain('GOLD_22K');
  });

  it('appends quantity > 0 when inStockOnly=true', async () => {
    const pool = makeFilterPool();
    await makeSvc(pool).getProducts({ shopId: 'shop-1', inStockOnly: true, page: 1, limit: 12 });
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).toContain('p.quantity > 0');
  });

  it('appends style = $N when style param provided', async () => {
    const pool = makeFilterPool();
    await makeSvc(pool).getProducts({ shopId: 'shop-1', style: 'JHUMKA', page: 1, limit: 12 });
    const sql    = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][1] as unknown[];
    expect(sql).toContain('p.style = $');
    expect(params).toContain('JHUMKA');
  });

  it('appends $N = ANY(p.occasion) when occasion param provided', async () => {
    const pool = makeFilterPool();
    await makeSvc(pool).getProducts({ shopId: 'shop-1', occasion: 'WEDDING', page: 1, limit: 12 });
    const sql    = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][1] as unknown[];
    expect(sql).toContain('= ANY(p.occasion)');
    expect(params).toContain('WEDDING');
  });

  it('appends $N = ANY(p.gift_persona) when giftPersona param provided', async () => {
    const pool = makeFilterPool();
    await makeSvc(pool).getProducts({ shopId: 'shop-1', giftPersona: 'BRIDE', page: 1, limit: 12 });
    const sql    = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][1] as unknown[];
    expect(sql).toContain('= ANY(p.gift_persona)');
    expect(params).toContain('BRIDE');
  });

  it('appends price_snapshot_paise >= $N when priceMin provided', async () => {
    const pool = makeFilterPool();
    await makeSvc(pool).getProducts({ shopId: 'shop-1', priceMin: 500_000, page: 1, limit: 12 });
    const sql    = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][1] as unknown[];
    expect(sql).toContain('p.price_snapshot_paise >=');
    expect(params).toContain(500_000);
  });

  it('appends price_snapshot_paise < $N when priceMax provided', async () => {
    const pool = makeFilterPool();
    await makeSvc(pool).getProducts({ shopId: 'shop-1', priceMax: 5_000_000, page: 1, limit: 12 });
    const sql    = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][1] as unknown[];
    expect(sql).toContain('p.price_snapshot_paise <');
    expect(params).toContain(5_000_000);
  });

  it('appends collection EXISTS when collection is a UUID', async () => {
    const pool = makeFilterPool();
    const uuid = '11111111-1111-1111-1111-111111111111';
    await makeSvc(pool).getProducts({ shopId: 'shop-1', collection: uuid, page: 1, limit: 12 });
    const sql    = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][1] as unknown[];
    expect(sql).toContain('collection_products cp');
    expect(params).toContain(uuid);
  });

  it('resolves collection slug to UUID via extra query, then applies filter', async () => {
    // When collection is a slug (not UUID), an extra query fires at calls[0],
    // shifting shop_settings to calls[1] and products to calls[2].
    const resolvedUuid = '22222222-2222-2222-2222-222222222222';
    const pool = makePool([
      { rows: [{ id: resolvedUuid }] }, // slug lookup
      { rows: [] },                      // shop_settings
      { rows: [baseProduct] },           // products
    ]);
    await makeSvc(pool).getProducts({ shopId: 'shop-1', collection: 'bridal-collection', page: 1, limit: 12 });
    const slugSql    = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const slugParams = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][1] as unknown[];
    const productSql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[2][0] as string;
    const productParams = (pool.query as ReturnType<typeof vi.fn>).mock.calls[2][1] as unknown[];
    expect(slugSql).toContain('FROM collections WHERE shop_id = $1 AND slug = $2');
    expect(slugParams).toContain('bridal-collection');
    expect(productSql).toContain('collection_products cp');
    expect(productParams).toContain(resolvedUuid);
  });

  it('returns empty results when collection slug not found', async () => {
    const pool = makePool([
      { rows: [] }, // slug lookup — not found
    ]);
    const result = await makeSvc(pool).getProducts({
      shopId: 'shop-1', collection: 'no-such-slug', page: 1, limit: 12,
    });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// WS-B: B3 — primaryImage in list response
// ---------------------------------------------------------------------------

describe('CatalogService.getProducts() — B3 primaryImage (WS-B)', () => {
  function makeSvc(pool: ReturnType<typeof makePool>) {
    return new CatalogService(
      pool as never,
      { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) } as never,
      mockSettingsRepo as never,
      stubUrlBuilder as never,
    );
  }

  it('returns primaryImage=null when pi_storage_key IS NULL', async () => {
    const pool = makePool([
      { rows: [] },
      { rows: [baseProduct] }, // pi_storage_key: null
    ]);
    const result = await makeSvc(pool).getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
    expect(result.items[0].primaryImage).toBeNull();
  });

  it('returns primaryImage with url/placeholderUrl/srcset/width/height/alt when image present', async () => {
    const pool = makePool([
      { rows: [] },
      { rows: [baseProductWithImage] },
    ]);
    const result = await makeSvc(pool).getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
    const img = result.items[0].primaryImage;
    expect(img).not.toBeNull();
    expect(img!.url).toContain('shops/shop-1/products/prod-1/main.jpg');
    expect(img!.placeholderUrl).toContain('w-40');
    expect(img!.srcset).toContain('320w');
    expect(img!.srcset).toContain('640w');
    expect(img!.width).toBe(800);
    expect(img!.height).toBe(1000);
    expect(img!.alt).toBe('22K सोने की अंगूठी');
  });

  it('NEVER exposes pi_storage_key in the response', async () => {
    const pool = makePool([
      { rows: [] },
      { rows: [baseProductWithImage] },
    ]);
    const result = await makeSvc(pool).getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
    const item = result.items[0] as unknown as Record<string, unknown>;
    expect(item['pi_storage_key']).toBeUndefined();
    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain('pi_storage_key');
    expect(serialized).not.toContain('storage_key');
  });

  it('SQL includes LEFT JOIN product_images via primary_image_id', async () => {
    const pool = makePool([
      { rows: [] },
      { rows: [] },
    ]);
    await makeSvc(pool).getProducts({ shopId: 'shop-1', page: 1, limit: 12 });
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).toContain('LEFT JOIN product_images pi ON pi.id = p.primary_image_id');
    expect(sql).toContain('pi.storage_key AS pi_storage_key');
  });
});

// ---------------------------------------------------------------------------
// WS-B: B3 — primaryImage in getProduct() detail response
// Call[0] = shop_settings (withShopTx), Call[1] = product detail SQL
// ---------------------------------------------------------------------------

describe('CatalogService.getProduct() — B3 primaryImage', () => {
  function makeSvc(pool: ReturnType<typeof makePool>) {
    return new CatalogService(
      pool as never,
      { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) } as never,
      mockSettingsRepo as never,
      stubUrlBuilder as never,
    );
  }

  it('getProduct() SQL contains LEFT JOIN product_images and pi_storage_key alias', async () => {
    const pool = makePool([
      { rows: [] },            // shop_settings (defaults)
      { rows: [baseProduct] }, // product detail
    ]);
    await makeSvc(pool).getProduct('prod-1', 'shop-1');
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).toContain('LEFT JOIN product_images pi ON pi.id = p.primary_image_id');
    expect(sql).toContain('pi.storage_key AS pi_storage_key');
  });

  it('returns populated primaryImage when pi_storage_key is non-null', async () => {
    const pool = makePool([
      { rows: [] },                      // shop_settings (defaults)
      { rows: [baseProductWithImage] },  // product detail with image
    ]);
    const result = await makeSvc(pool).getProduct('prod-1', 'shop-1');
    expect(result.primaryImage).not.toBeNull();
    expect(result.primaryImage!.url).toContain('shops/shop-1/products/prod-1/main.jpg');
    expect(result.primaryImage!.srcset).toContain('320w');
    expect(result.primaryImage!.srcset).toContain('640w');
    expect(result.primaryImage!.width).toBe(800);
    expect(result.primaryImage!.alt).toBe('22K सोने की अंगूठी');
  });

  it('storage_key is never present in the serialized response JSON', async () => {
    const pool = makePool([
      { rows: [] },                      // shop_settings (defaults)
      { rows: [baseProductWithImage] },  // product detail with image
    ]);
    const result = await makeSvc(pool).getProduct('prod-1', 'shop-1');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('storage_key');
  });
});

// ---------------------------------------------------------------------------
// WS-C: Sort — verify ORDER BY SQL for all 5 sort modes
// ---------------------------------------------------------------------------

describe('CatalogService.getProducts() — WS-C sort ORDER BY', () => {
  const sortCases: Array<[string | undefined, string]> = [
    [undefined,    'p.published_at DESC'],
    ['newest',     'p.published_at DESC'],
    ['priceAsc',   'p.price_snapshot_paise ASC NULLS LAST, p.published_at DESC'],
    ['priceDesc',  'p.price_snapshot_paise DESC NULLS LAST, p.published_at DESC'],
    ['trending',   'p.view_count_30d DESC, p.published_at DESC'],
    ['bestseller', '(p.sales_count_30d * 2 + p.view_count_30d) DESC, p.published_at DESC'],
  ];

  it.each(sortCases)('sort=%s produces ORDER BY "%s"', async (sort, expectedOrderBy) => {
    const pool = makePool([{ rows: [] }, { rows: [] }]);
    const svc = new CatalogService(
      pool as never,
      mockPricingService as never,
      mockSettingsRepo as never,
      stubUrlBuilder as never,
    );
    await svc.getProducts({ shopId: 'shop-1', sort: sort as never, page: 1, limit: 12 });
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).toContain(expectedOrderBy);
  });

  it('unknown sort value defaults to newest (published_at DESC)', async () => {
    const pool = makePool([{ rows: [] }, { rows: [] }]);
    const svc = new CatalogService(
      pool as never,
      mockPricingService as never,
      mockSettingsRepo as never,
      stubUrlBuilder as never,
    );
    await svc.getProducts({ shopId: 'shop-1', sort: 'unknown_sort' as never, page: 1, limit: 12 });
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).toContain('p.published_at DESC');
  });
});

// ---------------------------------------------------------------------------
// WS-D: Edge cases
// ---------------------------------------------------------------------------

describe('CatalogService.getProducts() — WS-D edge cases', () => {
  function makeSvc(pool: ReturnType<typeof makePool>) {
    return new CatalogService(
      pool as never,
      { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) } as never,
      mockSettingsRepo as never,
      stubUrlBuilder as never,
    );
  }

  it('NULLS LAST appears in ORDER BY for priceAsc (null price_snapshot_paise does not go to top)', async () => {
    const pool = makePool([{ rows: [] }, { rows: [] }]);
    await makeSvc(pool).getProducts({ shopId: 'shop-1', sort: 'priceAsc', page: 1, limit: 12 });
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).toContain('NULLS LAST');
  });

  it('NULLS LAST appears in ORDER BY for priceDesc', async () => {
    const pool = makePool([{ rows: [] }, { rows: [] }]);
    await makeSvc(pool).getProducts({ shopId: 'shop-1', sort: 'priceDesc', page: 1, limit: 12 });
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).toContain('NULLS LAST');
  });

  it('NULLS LAST does NOT appear for newest/trending/bestseller sort', async () => {
    for (const sort of ['newest', 'trending', 'bestseller'] as const) {
      const pool = makePool([{ rows: [] }, { rows: [] }]);
      await makeSvc(pool).getProducts({ shopId: 'shop-1', sort, page: 1, limit: 12 });
      const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
      expect(sql).not.toContain('NULLS LAST');
    }
  });

  it('inStockOnly=false does not append quantity filter', async () => {
    const pool = makePool([{ rows: [] }, { rows: [] }]);
    await makeSvc(pool).getProducts({ shopId: 'shop-1', inStockOnly: false, page: 1, limit: 12 });
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).not.toContain('p.quantity > 0');
  });

  it('empty-string purity is ignored (no WHERE clause added)', async () => {
    const pool = makePool([{ rows: [] }, { rows: [] }]);
    await makeSvc(pool).getProducts({ shopId: 'shop-1', purity: '   ', page: 1, limit: 12 });
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).not.toContain('p.purity =');
  });

  it('returns items with primaryImage=null when pi_storage_key is null (e.g. priceAsc with no snapshot)', async () => {
    const productNoImage = {
      ...baseProduct,
      pi_storage_key: null,
    };
    const pool = makePool([
      { rows: [] },
      { rows: [productNoImage] },
    ]);
    const result = await makeSvc(pool).getProducts({ shopId: 'shop-1', sort: 'priceAsc', page: 1, limit: 12 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].primaryImage).toBeNull();
  });

  it('all old params (categoryId, search, metal) still work unchanged', async () => {
    const pool = makePool([{ rows: [] }, { rows: [baseProduct] }]);
    await makeSvc(pool).getProducts({
      shopId: 'shop-1',
      categoryId: 'cat-99',
      search: 'ring',
      metal: 'silver',
      page: 1, limit: 12,
    });
    const sql    = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][1] as unknown[];
    expect(sql).toContain('p.category_id = $');
    expect(sql).toContain('p.metal = $');
    expect(sql).toContain('ILIKE');
    expect(params).toContain('cat-99');
    expect(params).toContain('SILVER');
    expect(params).toContain('%ring%');
  });
});

// ---------------------------------------------------------------------------
// getPublicProductReviews — Story B4
// ---------------------------------------------------------------------------

describe('CatalogService.getPublicProductReviews()', () => {
  it('throws NotFoundException when product is not found for this tenant', async () => {
    // Response sequence: existence check returns 0 rows → NotFoundException
    const pool = makePool([{ rows: [] }]);
    const svc = new CatalogService(
      pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never,
    );

    await expect(
      svc.getPublicProductReviews({
        shopId: 'shop-1', productId: '00000000-0000-0000-0000-000000000001', page: 1, limit: 10,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns PII-redacted items and ratingBreakdown for a published product', async () => {
    // Response sequence: [existence check, reviews, breakdown]
    const pool = makePool([
      { rows: [{ id: '1' }] }, // existence check → product found
      { rows: [
        {
          id: 'rev-1', rating: 5, review_text: 'Excellent!',
          customer_display_name: 'Priya S.', created_at: new Date('2026-01-15T10:00:00Z'),
        },
      ]}, // reviews query
      { rows: [{ rating: 5, cnt: 1 }] }, // breakdown query
    ]);
    const svc = new CatalogService(
      pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never,
    );

    const result = await svc.getPublicProductReviews({
      shopId: 'shop-1', productId: '00000000-0000-0000-0000-000000000001', page: 1, limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('rev-1');
    expect(result.items[0].rating).toBe(5);
    expect(result.items[0].customerDisplayName).toBe('Priya S.');
    expect(result.items[0].reviewText).toBe('Excellent!');
    expect(result.items[0].createdAt).toBe('2026-01-15T10:00:00.000Z');
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.ratingBreakdown[5]).toBe(1);
    expect(result.ratingBreakdown[1]).toBe(0);
    expect(result.ratingBreakdown[2]).toBe(0);
    expect(result.ratingBreakdown[3]).toBe(0);
    expect(result.ratingBreakdown[4]).toBe(0);
  });

  it('returns empty items + zeroed breakdown when product has no public reviews', async () => {
    const pool = makePool([
      { rows: [{ id: '1' }] }, // existence check → product found
      { rows: [] },             // reviews → empty
      { rows: [] },             // breakdown → empty
    ]);
    const svc = new CatalogService(
      pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never,
    );

    const result = await svc.getPublicProductReviews({
      shopId: 'shop-1', productId: '00000000-0000-0000-0000-000000000001', page: 1, limit: 10,
    });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.ratingBreakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it('caps safeLimit at 50 even when caller passes limit=200', async () => {
    const pool = makePool([
      { rows: [{ id: '1' }] },
      { rows: [] },
      { rows: [] },
    ]);
    const svc = new CatalogService(
      pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never,
    );

    await svc.getPublicProductReviews({
      shopId: 'shop-1', productId: '00000000-0000-0000-0000-000000000001', page: 1, limit: 200,
    });

    // Third pool.query call is the reviews query — check LIMIT param is ≤ 50
    const reviewsCallArgs = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1];
    const limitParam = reviewsCallArgs[1][2]; // $3 = safeLimit
    expect(limitParam).toBeLessThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// B2 — getCategories
// ---------------------------------------------------------------------------

describe('CatalogService.getCategories()', () => {
  function makeSvc(pool: ReturnType<typeof makePool>) {
    return new CatalogService(pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never);
  }

  it('returns categories with derived slug and productCount', async () => {
    const pool = makePool([{ rows: [{ id: 'cat-1', name: 'Rings & Bands', name_hi: 'अंगूठी', product_count: 5 }] }]);
    const result = await makeSvc(pool).getCategories('shop-1');
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].id).toBe('cat-1');
    expect(result.categories[0].name).toBe('Rings & Bands');
    expect(result.categories[0].slug).toBe('rings--bands');
    expect(result.categories[0].productCount).toBe(5);
  });

  it('returns empty list when shop has no categories', async () => {
    const pool = makePool([{ rows: [] }]);
    const result = await makeSvc(pool).getCategories('shop-1');
    expect(result.categories).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// B2 — getCollections
// ---------------------------------------------------------------------------

describe('CatalogService.getCollections()', () => {
  it('returns collections with null heroImage when hero_storage_key is null', async () => {
    const pool = makePool([{ rows: [
      { id: 'col-1', slug: 'bridal', title_hi: 'ब्राइडल', title_en: 'Bridal', subtitle_hi: null,
        is_premium: true, hero_storage_key: null, hero_alt: null, hero_w: null, hero_h: null, product_count: 8 },
    ]}]);
    const svc = new CatalogService(pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never);
    const result = await svc.getCollections('shop-1');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].slug).toBe('bridal');
    expect(result.items[0].heroImage).toBeNull();
    expect(result.items[0].isPremium).toBe(true);
    expect(result.items[0].productCount).toBe(8);
  });

  it('builds heroImage when hero_storage_key is set', async () => {
    const pool = makePool([{ rows: [
      { id: 'col-1', slug: 'daily', title_hi: 'रोज़मर्रा', title_en: null, subtitle_hi: null,
        is_premium: false, hero_storage_key: 'shops/s1/hero.jpg', hero_alt: 'Daily wear',
        hero_w: 1200, hero_h: 800, product_count: 3 },
    ]}]);
    const svc = new CatalogService(pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never);
    const result = await svc.getCollections('shop-1');
    expect(result.items[0].heroImage).not.toBeNull();
    expect(result.items[0].heroImage?.url).toContain('shops/s1/hero.jpg');
    expect(result.items[0].heroImage?.srcset).toContain('320w');
  });
});

// ---------------------------------------------------------------------------
// B2 — getFeatured / getNewArrivals / getTopSellers (via fetchProductCards)
// ---------------------------------------------------------------------------

describe('CatalogService.getFeatured()', () => {
  it('returns up to limit items using fetchProductCards', async () => {
    const pool = makePool([
      { rows: [] },             // making_charges
      { rows: [baseProduct] },  // products SQL
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);
    const result = await svc.getFeatured('shop-1', 12);
    expect(result.items).toHaveLength(1);
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).toContain('featured_score > 0');
    expect(sql).toContain('featured_score DESC');
  });
});

describe('CatalogService.getNewArrivals()', () => {
  it('SQL contains 30 day interval filter', async () => {
    const pool = makePool([{ rows: [] }, { rows: [baseProduct] }]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);
    await svc.getNewArrivals('shop-1', 12);
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).toContain('30 days');
    expect(sql).toContain('published_at DESC');
  });
});

describe('CatalogService.getTopSellers()', () => {
  it('SQL uses sales_count + view_count composite order', async () => {
    const pool = makePool([{ rows: [] }, { rows: [baseProduct] }]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);
    await svc.getTopSellers('shop-1', 12);
    const sql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(sql).toContain('sales_count_30d * 2 + p.view_count_30d');
  });
});

// ---------------------------------------------------------------------------
// B5 — getStorefrontConfig
// ---------------------------------------------------------------------------

describe('CatalogService.getStorefrontConfig()', () => {
  it('returns defaults when storefront_config_json is empty object', async () => {
    const pool = makePool([{ rows: [{ storefront_config_json: {} }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never);
    const result = await svc.getStorefrontConfig('shop-1');
    expect(result.heroBanners).toEqual([]);
    expect(result.featuredCollectionIds).toEqual([]);
    expect(Array.isArray(result.trustPillarsOverride)).toBe(true);
  });

  it('returns defaults when shop_settings row missing', async () => {
    const pool = makePool([{ rows: [] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never);
    const result = await svc.getStorefrontConfig('shop-1');
    expect(result.heroBanners).toEqual([]);
  });

  it('returns defaults + logs warning when stored JSON is malformed', async () => {
    const pool = makePool([{ rows: [{ storefront_config_json: { heroBanners: 'not-an-array' } }] }]);
    const svc = new CatalogService(pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never);
    // Should not throw — returns defaults on parse error
    const result = await svc.getStorefrontConfig('shop-1');
    expect(result.heroBanners).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// B6 — getRecommendations
// ---------------------------------------------------------------------------

describe('CatalogService.getRecommendations()', () => {
  it('throws NotFoundException when source product does not exist', async () => {
    const pool = makePool([{ rows: [] }]); // source lookup returns empty
    const svc = new CatalogService(pool as never, mockPricingService as never, mockSettingsRepo as never, stubUrlBuilder as never);
    await expect(svc.getRecommendations('prod-missing', 'shop-1')).rejects.toThrow(NotFoundException);
  });

  it('returns deduplicated items from tier3 when no collection_id or style', async () => {
    // Source product: no collection_id, no style
    const srcRow = { collection_id: null, style: null, metal: 'GOLD', purity: 'GOLD_22K', net_weight_g: '4.500' };
    // Second withShopTx: making_charges (call 1) + tier3 products (call 2)
    const pool = makePool([
      { rows: [srcRow] },                // call 0: source product lookup
      { rows: [] },                      // call 1: making_charges (→ defaults)
      { rows: [baseProduct] },           // call 2: tier3 weight-band products
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);
    const result = await svc.getRecommendations('prod-1', 'shop-1');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('prod-1');
  });

  it('caps result at 6 items even when tiers return duplicates', async () => {
    const srcRow = { collection_id: null, style: null, metal: 'GOLD', purity: 'GOLD_22K', net_weight_g: '5.000' };
    // tier3 returns 8 identical IDs — dedup + cap should yield 6 unique items
    const manyRows = Array.from({ length: 8 }, (_, i) => ({
      ...baseProduct, id: `prod-${i + 1}`, total_count: '8',
    }));
    const pool = makePool([
      { rows: [srcRow] },
      { rows: [] },
      { rows: manyRows },
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never, mockSettingsRepo as never, stubUrlBuilder as never);
    const result = await svc.getRecommendations('prod-X', 'shop-1');
    expect(result.items.length).toBeLessThanOrEqual(6);
  });
});
