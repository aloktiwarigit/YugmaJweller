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
