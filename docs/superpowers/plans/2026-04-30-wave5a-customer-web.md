# Wave 5A — Customer Web Scaffold + Catalog API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `apps/customer-web` (Next.js 14 App Router, Hindi-first, Direction 05) and implement the public catalog API (`catalog.service.ts` + 3 endpoints) that powers it.

**Architecture:** New `CatalogService` writes its own raw pool queries (no coupling to authenticated `InventoryRepository`). Three public endpoints (`@SkipAuth + @SkipTenant`) with per-class throttling. Next.js server components fetch tenant config + catalog data at request time; theme is injected as CSS variables from `shops.config` JSONB.

**Tech Stack:** NestJS 10, PostgreSQL (raw pool), `@goldsmith/money` (`computeProductPrice`), `@goldsmith/shared` (`MAKING_CHARGE_DEFAULTS`, `PurityKey`), Next.js 14 App Router, Tailwind CSS, shadcn/ui, `next/font/google` (Yatra One + Noto Sans Devanagari), `@nestjs/throttler@^5`.

---

## File Map

### API (WS-A)
| Action | Path |
|--------|------|
| Create | `apps/api/src/modules/catalog/catalog.service.ts` |
| Create | `apps/api/src/modules/catalog/catalog.service.spec.ts` |
| Modify | `apps/api/src/modules/catalog/catalog.controller.ts` |
| Modify | `apps/api/src/modules/catalog/catalog.controller.spec.ts` |
| Modify | `apps/api/src/modules/catalog/catalog.module.ts` |
| Modify | `apps/api/src/drizzle-tenant-lookup.ts` |
| Modify | `apps/api/src/app.module.ts` |
| Modify | `apps/api/package.json` |

### Web Scaffold (WS-B)
| Action | Path |
|--------|------|
| Create | `apps/customer-web/package.json` |
| Create | `apps/customer-web/next.config.ts` |
| Create | `apps/customer-web/tailwind.config.ts` |
| Create | `apps/customer-web/postcss.config.js` |
| Create | `apps/customer-web/tsconfig.json` |
| Create | `apps/customer-web/components.json` |
| Modify | `turbo.json` |

### Web Pages (WS-C)
| Action | Path |
|--------|------|
| Create | `apps/customer-web/app/layout.tsx` |
| Create | `apps/customer-web/app/page.tsx` |
| Create | `apps/customer-web/app/not-found.tsx` |
| Create | `apps/customer-web/app/error.tsx` |
| Create | `apps/customer-web/app/products/page.tsx` |
| Create | `apps/customer-web/app/products/[id]/page.tsx` |
| Create | `apps/customer-web/lib/api.ts` |
| Create | `apps/customer-web/lib/theme.ts` |
| Create | `apps/customer-web/components/GoldRateCard.tsx` |
| Create | `apps/customer-web/components/ProductCard.tsx` |
| Create | `apps/customer-web/components/ProductGrid.tsx` |
| Create | `apps/customer-web/components/CategorySidebar.tsx` |
| Create | `apps/customer-web/components/HuidBadge.tsx` |
| Create | `apps/customer-web/components/EstimatedPriceBadge.tsx` |
| Create | `apps/customer-web/components/WishlistButton.tsx` |
| Create | `apps/customer-web/components/GoldTexturePlaceholder.tsx` |

---

## Task 1: Install @nestjs/throttler + add bySlug to DrizzleTenantLookup

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/drizzle-tenant-lookup.ts`

- [ ] **Step 1.1: Install throttler**

Run from `C:/gs-cust-web`:
```bash
cd apps/api && pnpm add @nestjs/throttler@^5 && cd ../..
```

- [ ] **Step 1.2: Add `bySlug` to DrizzleTenantLookup**

Open `apps/api/src/drizzle-tenant-lookup.ts`. The current file only has `byId`. Add `bySlug` following the same cache pattern, but keyed on `slug:${slug}` and filtering to `ACTIVE` shops only:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import type { Tenant, TenantLookup } from '@goldsmith/tenant-context';

const TTL_MS = 60_000;

@Injectable()
export class DrizzleTenantLookup implements TenantLookup {
  private cache = new Map<string, { t: Tenant; exp: number }>();

  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async byId(id: string): Promise<Tenant | undefined> {
    const hit = this.cache.get(id);
    if (hit && hit.exp > Date.now()) return hit.t;
    const c = await this.pool.connect();
    try {
      const r = await c.query(
        `SELECT id, slug, display_name, status, config FROM shops WHERE id = $1`, [id],
      );
      if (r.rows.length === 0) return undefined;
      const t = r.rows[0] as Tenant;
      this.cache.set(id, { t, exp: Date.now() + TTL_MS });
      return t;
    } finally { c.release(); }
  }

  async bySlug(slug: string): Promise<Tenant | undefined> {
    const cacheKey = `slug:${slug}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.exp > Date.now()) return hit.t;
    const c = await this.pool.connect();
    try {
      const r = await c.query(
        `SELECT id, slug, display_name, status, config FROM shops WHERE slug = $1 AND status = 'ACTIVE'`,
        [slug],
      );
      if (r.rows.length === 0) return undefined;
      const t = r.rows[0] as Tenant;
      this.cache.set(cacheKey, { t, exp: Date.now() + TTL_MS });
      return t;
    } finally { c.release(); }
  }

  invalidate(id: string): void { this.cache.delete(id); }
}
```

- [ ] **Step 1.3: Commit**

```bash
git add apps/api/package.json apps/api/src/drizzle-tenant-lookup.ts pnpm-lock.yaml
git commit -m "feat(catalog): install @nestjs/throttler + add bySlug to DrizzleTenantLookup"
```

---

## Task 2: CatalogService — getTenantConfig (TDD)

**Files:**
- Create: `apps/api/src/modules/catalog/catalog.service.ts` (partial — getTenantConfig only)
- Create: `apps/api/src/modules/catalog/catalog.service.spec.ts` (partial)

- [ ] **Step 2.1: Write failing tests for getTenantConfig**

Create `apps/api/src/modules/catalog/catalog.service.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-30T10:00:00.000Z');

const fakeRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: NOW },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: NOW },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: NOW },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: NOW },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: NOW },
  SILVER_999: { perGramPaise: 9500n,  fetchedAt: NOW },
  SILVER_925: { perGramPaise: 8788n,  fetchedAt: NOW },
  stale: false,
  source: 'ibja',
};

const mockPricingService = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };

function makePool(responses: Array<{ rows: object[] }>) {
  let callIdx = 0;
  return { query: vi.fn().mockImplementation(() => Promise.resolve(responses[callIdx++] ?? { rows: [] })) };
}

// ---------------------------------------------------------------------------
// getTenantConfig
// ---------------------------------------------------------------------------

describe('CatalogService.getTenantConfig()', () => {
  it('returns config for an active shop with null config JSONB (uses defaults)', async () => {
    const pool = makePool([
      { rows: [{ id: 'shop-1', slug: 'test-shop', display_name: 'Test Jewellers', logo_url: null, config: null }] },
    ]);
    const svc = new CatalogService(pool as never, mockPricingService as never);

    const result = await svc.getTenantConfig('test-shop');

    expect(result).toEqual({
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
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
cd C:/gs-cust-web && pnpm --filter @goldsmith/api test -- --run --reporter=verbose catalog.service.spec.ts
```

Expected: FAIL — `CatalogService` not found / import error.

- [ ] **Step 2.3: Implement CatalogService.getTenantConfig**

Create `apps/api/src/modules/catalog/catalog.service.ts`:

```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PricingService } from '../pricing/pricing.service';
import { computeProductPrice } from '@goldsmith/money';
import type { PriceBreakdown } from '@goldsmith/money';
import { MAKING_CHARGE_DEFAULTS } from '@goldsmith/shared';
import type { MakingChargeConfig } from '@goldsmith/shared';

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface TenantConfigResponse {
  primaryColor:    string;
  logoUrl:         string | null;
  appName:         string;
  defaultLanguage: string;
}

export interface EstimatedPrice {
  totalFormatted: string;
  totalPaise:     string;
  breakdown: {
    goldValuePaise:    string;
    makingChargePaise: string;
    gstMetalPaise:     string;
    gstMakingPaise:    string;
  };
}

export interface CatalogProduct {
  id:                    string;
  sku:                   string;
  metal:                 string;
  purity:                string;
  categoryId:            string | null;
  categoryName:          string | null;
  grossWeightG:          string;
  netWeightG:            string;
  huid:                  string | null;
  huidExemptionCategory: string;
  quantity:              number;
  priceAvailable:        boolean;
  estimatedPrice?:       EstimatedPrice;
  publishedAt:           string;
}

export interface CatalogProductsResponse {
  items: CatalogProduct[];
  total: number;
  page:  number;
}

export interface GetProductsParams {
  shopId:      string;
  categoryId?: string;
  search?:     string;
  page:        number;
  limit:       number;
}

// ---------------------------------------------------------------------------
// Internal row shapes
// ---------------------------------------------------------------------------

interface ShopRow {
  id:           string;
  display_name: string;
  logo_url:     string | null;
  config:       Record<string, unknown> | null;
}

interface ProductCatalogRow {
  id:                       string;
  sku:                      string;
  metal:                    string;
  purity:                   string;
  category_id:              string | null;
  category_name:            string | null;
  gross_weight_g:           string;
  net_weight_g:             string;
  making_charge_override_pct: string | null;
  huid:                     string | null;
  huid_exemption_category:  string;
  quantity:                 number;
  published_at:             Date;
  total_count:              string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CatalogService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    @Inject(PricingService) private readonly pricingService: PricingService,
  ) {}

  async getTenantConfig(slug: string): Promise<TenantConfigResponse> {
    const r = await this.pool.query<ShopRow>(
      `SELECT id, display_name, logo_url, config
         FROM shops
        WHERE slug = $1 AND status = 'ACTIVE'`,
      [slug],
    );
    if (r.rows.length === 0) {
      throw new NotFoundException({ code: 'catalog.shop_not_found' });
    }
    const row = r.rows[0];
    return {
      primaryColor:    (row.config?.['primaryColor'] as string | undefined) ?? '#B58A3C',
      logoUrl:         row.logo_url ?? null,
      appName:         row.display_name,
      defaultLanguage: (row.config?.['defaultLanguage'] as string | undefined) ?? 'hi',
    };
  }

  async getProducts(params: GetProductsParams): Promise<CatalogProductsResponse> {
    const { shopId, categoryId, search, page, limit } = params;
    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset    = (safePage - 1) * safeLimit;

    // Build parameterized query
    const queryParams: unknown[] = [shopId];
    let whereExtra = '';

    if (categoryId) {
      queryParams.push(categoryId);
      whereExtra += ` AND p.category_id = $${queryParams.length}`;
    }
    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      queryParams.push(term);
      whereExtra += ` AND (p.sku ILIKE $${queryParams.length} OR p.metal ILIKE $${queryParams.length} OR p.purity ILIKE $${queryParams.length})`;
    }

    queryParams.push(safeLimit, offset);
    const limitIdx  = queryParams.length - 1;
    const offsetIdx = queryParams.length;

    const sql = `
      SELECT p.id, p.sku, p.metal, p.purity, p.category_id,
             pc.name AS category_name,
             p.gross_weight_g, p.net_weight_g,
             p.making_charge_override_pct,
             p.huid, p.huid_exemption_category, p.quantity, p.published_at,
             COUNT(*) OVER() AS total_count
        FROM products p
        LEFT JOIN product_categories pc ON pc.id = p.category_id
       WHERE p.shop_id = $1
         AND p.status = 'PUBLISHED'
         ${whereExtra}
       ORDER BY p.published_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const [ratesResult, mcResult, productsResult] = await Promise.all([
      this.pricingService.getCurrentRates(),
      this.pool.query<{ making_charges_json: MakingChargeConfig[] | null }>(
        `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      ),
      this.pool.query<ProductCatalogRow>(sql, queryParams),
    ]);

    const configs: MakingChargeConfig[] = mcResult.rows[0]?.making_charges_json ?? MAKING_CHARGE_DEFAULTS;
    const mcMap = new Map<string, string>(configs.map((c) => [c.category, c.value]));

    const total = productsResult.rows.length > 0 ? Number(productsResult.rows[0].total_count) : 0;

    const items: CatalogProduct[] = productsResult.rows.map((row) =>
      this.computeCatalogProduct(row, ratesResult, mcMap),
    );

    return { items, total, page: safePage };
  }

  async getProduct(id: string, shopId: string): Promise<CatalogProduct> {
    const [ratesResult, mcResult, productResult] = await Promise.all([
      this.pricingService.getCurrentRates(),
      this.pool.query<{ making_charges_json: MakingChargeConfig[] | null }>(
        `SELECT making_charges_json FROM shop_settings WHERE shop_id = $1`,
        [shopId],
      ),
      this.pool.query<ProductCatalogRow>(
        `SELECT p.id, p.sku, p.metal, p.purity, p.category_id,
                pc.name AS category_name,
                p.gross_weight_g, p.net_weight_g,
                p.making_charge_override_pct,
                p.huid, p.huid_exemption_category, p.quantity, p.published_at,
                '1' AS total_count
           FROM products p
           LEFT JOIN product_categories pc ON pc.id = p.category_id
          WHERE p.id = $1 AND p.shop_id = $2 AND p.status = 'PUBLISHED'`,
        [id, shopId],
      ),
    ]);

    if (productResult.rows.length === 0) {
      throw new NotFoundException({ code: 'catalog.product_not_found' });
    }

    const configs: MakingChargeConfig[] = mcResult.rows[0]?.making_charges_json ?? MAKING_CHARGE_DEFAULTS;
    const mcMap = new Map<string, string>(configs.map((c) => [c.category, c.value]));

    return this.computeCatalogProduct(productResult.rows[0], ratesResult, mcMap);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private computeCatalogProduct(
    row: ProductCatalogRow,
    rates: Record<string, { perGramPaise: bigint }>,
    mcMap: Map<string, string>,
  ): CatalogProduct {
    const rateEntry = rates[row.purity as keyof typeof rates] as { perGramPaise: bigint } | undefined;

    let priceAvailable = false;
    let estimatedPrice: EstimatedPrice | undefined;

    if (rateEntry) {
      const makingChargePct =
        row.making_charge_override_pct ??
        mcMap.get(row.category_name ?? '') ??
        '12.00';

      try {
        const breakdown: PriceBreakdown = computeProductPrice({
          netWeightG:        row.net_weight_g,
          ratePerGramPaise:  rateEntry.perGramPaise,
          makingChargePct,
          stoneChargesPaise: 0n,
          hallmarkFeePaise:  0n,
        });

        priceAvailable = true;
        estimatedPrice = {
          totalFormatted: breakdown.totalFormatted,
          totalPaise:     breakdown.totalPaise.toString(),
          breakdown: {
            goldValuePaise:    breakdown.goldValuePaise.toString(),
            makingChargePaise: breakdown.makingChargePaise.toString(),
            gstMetalPaise:     breakdown.gstMetalPaise.toString(),
            gstMakingPaise:    breakdown.gstMakingPaise.toString(),
          },
        };
      } catch {
        // RangeError from computeProductPrice (e.g. zero weight) — show "contact for price"
      }
    }

    return {
      id:                    row.id,
      sku:                   row.sku,
      metal:                 row.metal,
      purity:                row.purity,
      categoryId:            row.category_id,
      categoryName:          row.category_name,
      grossWeightG:          row.gross_weight_g,
      netWeightG:            row.net_weight_g,
      huid:                  row.huid,
      huidExemptionCategory: row.huid_exemption_category,
      quantity:              row.quantity,
      priceAvailable,
      estimatedPrice,
      publishedAt:           row.published_at.toISOString(),
    };
  }
}
```

- [ ] **Step 2.4: Run getTenantConfig tests**

```bash
cd C:/gs-cust-web && pnpm --filter @goldsmith/api test -- --run --reporter=verbose catalog.service.spec.ts
```

Expected: 3/3 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add apps/api/src/modules/catalog/catalog.service.ts apps/api/src/modules/catalog/catalog.service.spec.ts
git commit -m "feat(catalog): CatalogService — getTenantConfig with null-safe config JSONB"
```

---

## Task 3: CatalogService — getProducts + getProduct (TDD)

**Files:**
- Modify: `apps/api/src/modules/catalog/catalog.service.spec.ts`

- [ ] **Step 3.1: Add failing tests for getProducts and getProduct**

Append to `catalog.service.spec.ts` (after the existing describe block):

```typescript
// ---------------------------------------------------------------------------
// getProducts
// ---------------------------------------------------------------------------

const baseProduct: ProductCatalogRow = {
  id: 'prod-1', sku: 'GLD-001', metal: 'GOLD', purity: 'GOLD_22K',
  category_id: 'cat-1', category_name: 'RINGS',
  gross_weight_g: '5.0000', net_weight_g: '4.5000',
  making_charge_override_pct: null,
  huid: 'HU123456', huid_exemption_category: 'none',
  quantity: 2, published_at: NOW, total_count: '1',
};

// NOTE: ProductCatalogRow is not exported — use the interface inline in tests
// (TypeScript will infer from the object literal)

describe('CatalogService.getProducts()', () => {
  it('returns priceAvailable=true with computed price for known purity', async () => {
    const pool = makePool([
      { rows: [fakeRates] },            // getCurrentRates (unused here — see pricing mock)
      { rows: [] },                      // shop_settings (missing → defaults)
      { rows: [baseProduct] },           // products query
    ]);
    // Override mockPricingService for this test
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].priceAvailable).toBe(true);
    expect(result.items[0].estimatedPrice?.totalFormatted).toMatch(/^₹/);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('returns priceAvailable=false for unknown purity (e.g. PLATINUM_950)', async () => {
    const pool = makePool([
      { rows: [] },                      // shop_settings
      { rows: [{ ...baseProduct, purity: 'PLATINUM_950', total_count: '1' }] },
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });

    expect(result.items[0].priceAvailable).toBe(false);
    expect(result.items[0].estimatedPrice).toBeUndefined();
  });

  it('returns priceAvailable=false for zero net_weight_g (RangeError guard)', async () => {
    const pool = makePool([
      { rows: [] },
      { rows: [{ ...baseProduct, net_weight_g: '0.0000', total_count: '1' }] },
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });

    expect(result.items[0].priceAvailable).toBe(false);
  });

  it('uses shop making charges over defaults when shop_settings row exists', async () => {
    const customMc = [{ category: 'RINGS', type: 'percent', value: '20.00' }];
    const pool = makePool([
      { rows: [{ making_charges_json: customMc }] },
      { rows: [baseProduct] },
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 12 });

    // With 20% making charge vs 12% default, the price should be higher
    const withDefault = computeProductPrice({
      netWeightG: '4.5000', ratePerGramPaise: 673750n,
      makingChargePct: '12.00', stoneChargesPaise: 0n, hallmarkFeePaise: 0n,
    });
    const withCustom = computeProductPrice({
      netWeightG: '4.5000', ratePerGramPaise: 673750n,
      makingChargePct: '20.00', stoneChargesPaise: 0n, hallmarkFeePaise: 0n,
    });
    expect(BigInt(result.items[0].estimatedPrice!.totalPaise)).toBe(withCustom.totalPaise);
    expect(withCustom.totalPaise).toBeGreaterThan(withDefault.totalPaise);
  });

  it('falls back to 12.00% when no making charge matches category', async () => {
    const pool = makePool([
      { rows: [] },  // no shop_settings → MAKING_CHARGE_DEFAULTS used
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

  it('clamps limit to max 50', async () => {
    const pool = makePool([{ rows: [] }, { rows: [] }]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProducts({ shopId: 'shop-1', page: 1, limit: 200 });
    expect(result.items).toHaveLength(0);
    // Verify pool.query was called (limit clamped internally — no crash)
    expect(pool.query).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getProduct
// ---------------------------------------------------------------------------

describe('CatalogService.getProduct()', () => {
  it('returns product detail with computed price', async () => {
    const pool = makePool([
      { rows: [] },           // shop_settings
      { rows: [baseProduct] },
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    const result = await svc.getProduct('prod-1', 'shop-1');

    expect(result.id).toBe('prod-1');
    expect(result.huid).toBe('HU123456');
    expect(result.priceAvailable).toBe(true);
  });

  it('throws NotFoundException when product not found', async () => {
    const pool = makePool([
      { rows: [] },  // shop_settings
      { rows: [] },  // product not found
    ]);
    const ps = { getCurrentRates: vi.fn().mockResolvedValue(fakeRates) };
    const svc = new CatalogService(pool as never, ps as never);

    await expect(svc.getProduct('nonexistent', 'shop-1')).rejects.toThrow(NotFoundException);
  });
});
```

Also add this import at the top of the spec file (after existing imports):
```typescript
import { computeProductPrice } from '@goldsmith/money';
import type { ProductCatalogRow } from './catalog.service';
```

And add `export` to `interface ProductCatalogRow` in `catalog.service.ts` (needed for test import):
```typescript
export interface ProductCatalogRow { ... }
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
cd C:/gs-cust-web && pnpm --filter @goldsmith/api test -- --run --reporter=verbose catalog.service.spec.ts
```

Expected: 9 new test failures (getProducts + getProduct not yet implemented beyond getTenantConfig).

- [ ] **Step 3.3: Verify tests pass with existing implementation**

`getProducts` and `getProduct` are already implemented in Task 2 Step 2.3. Run again — all tests should now pass.

```bash
cd C:/gs-cust-web && pnpm --filter @goldsmith/api test -- --run --reporter=verbose catalog.service.spec.ts
```

Expected: all 12 tests PASS.

- [ ] **Step 3.4: Commit**

```bash
git add apps/api/src/modules/catalog/catalog.service.spec.ts apps/api/src/modules/catalog/catalog.service.ts
git commit -m "test(catalog): CatalogService unit tests — getTenantConfig, getProducts, getProduct"
```

---

## Task 4: Wire catalog.controller.ts + catalog.module.ts + AppModule throttler

**Files:**
- Modify: `apps/api/src/modules/catalog/catalog.controller.ts`
- Modify: `apps/api/src/modules/catalog/catalog.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 4.1: Update catalog.controller.ts**

Replace `apps/api/src/modules/catalog/catalog.controller.ts` entirely:

```typescript
import {
  BadRequestException, Controller, Get, Header,
  Headers, HttpCode, HttpException, HttpStatus,
  Inject, Ip, Param, ParseUUIDPipe, Post, Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { PricingService } from '../pricing/pricing.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CatalogService } from './catalog.service';
import type { TenantConfigResponse, CatalogProductsResponse, CatalogProduct } from './catalog.service';
import { RatesUnavailableError } from '@goldsmith/rates';

// ---------------------------------------------------------------------------
// Public rates response shape (Story 4.4 — unchanged)
// ---------------------------------------------------------------------------

export interface PublicRateEntry {
  perGramRupees: string;
  formattedINR: string;
  fetchedAt: string;
}

export interface PublicRatesResponse {
  GOLD_24K: PublicRateEntry;
  GOLD_22K: PublicRateEntry;
  SILVER_999: PublicRateEntry;
  stale: boolean;
  source: string;
  refreshedAt: string;
}

function toPublicEntry(paise: bigint, fetchedAt: Date): PublicRateEntry {
  const rupees = (Number(paise) / 100).toFixed(2);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(paise) / 100);
  return {
    perGramRupees: rupees,
    formattedINR: `₹${formatted}`,
    fetchedAt: fetchedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Controller — throttled at class level for public catalog endpoints
// ---------------------------------------------------------------------------

@Controller('/api/v1/catalog')
@UseGuards(ThrottlerGuard)
export class CatalogController {
  private readonly viewRateCache = new Map<string, true>();

  constructor(
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject(AnalyticsService) private readonly analyticsService: AnalyticsService,
    @Inject(CatalogService) private readonly catalogService: CatalogService,
  ) {}

  // -------------------------------------------------------------------------
  // GET /catalog/tenant-config
  // -------------------------------------------------------------------------

  @Get('tenant-config')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=3600')
  async getTenantConfig(
    @Headers('x-shop-slug') slug: string,
  ): Promise<TenantConfigResponse> {
    if (!slug) throw new BadRequestException({ code: 'catalog.slug_required' });
    return this.catalogService.getTenantConfig(slug);
  }

  // -------------------------------------------------------------------------
  // GET /catalog/products
  // -------------------------------------------------------------------------

  @Get('products')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
  async listPublished(
    @Headers('x-tenant-id') shopId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '12',
  ): Promise<CatalogProductsResponse> {
    if (!shopId) throw new BadRequestException({ code: 'catalog.tenant_id_required' });
    return this.catalogService.getProducts({
      shopId,
      categoryId,
      search,
      page:  Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 12)),
    });
  }

  // -------------------------------------------------------------------------
  // GET /catalog/products/:id
  // -------------------------------------------------------------------------

  @Get('products/:id')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
  async getProduct(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Headers('x-tenant-id') shopId: string,
  ): Promise<CatalogProduct> {
    if (!shopId) throw new BadRequestException({ code: 'catalog.tenant_id_required' });
    return this.catalogService.getProduct(productId, shopId);
  }

  // -------------------------------------------------------------------------
  // GET /catalog/rates — Story 4.4 (unchanged)
  // -------------------------------------------------------------------------

  @Get('rates')
  @SkipAuth()
  @SkipTenant()
  @Header('Cache-Control', 'public, max-age=60')
  async getPublicRates(): Promise<PublicRatesResponse> {
    try {
      const rates = await this.pricingService.getCurrentRates();
      return {
        GOLD_24K:    toPublicEntry(rates.GOLD_24K.perGramPaise, rates.GOLD_24K.fetchedAt),
        GOLD_22K:    toPublicEntry(rates.GOLD_22K.perGramPaise, rates.GOLD_22K.fetchedAt),
        SILVER_999:  toPublicEntry(rates.SILVER_999.perGramPaise, rates.SILVER_999.fetchedAt),
        stale:       rates.stale,
        source:      rates.source,
        refreshedAt: rates.GOLD_24K.fetchedAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof RatesUnavailableError) {
        throw new HttpException(
          { code: 'rates.unavailable', stale: true },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // POST /catalog/products/:id/view — Story 3B analytics (unchanged)
  // -------------------------------------------------------------------------

  @Post('products/:id/view')
  @HttpCode(204)
  @SkipAuth()
  @SkipTenant()
  async recordProductView(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Headers('x-tenant-id') shopId: string,
    @Ip() ip: string,
    @Body() body: { sessionId?: string; customerId?: string; durationSeconds?: number },
  ): Promise<void> {
    if (!shopId || !body.sessionId) return;

    const rateCacheKey = `${ip}:${productId}`;
    if (this.viewRateCache.has(rateCacheKey)) return;
    this.viewRateCache.set(rateCacheKey, true);
    setTimeout(() => this.viewRateCache.delete(rateCacheKey), 60_000);

    void this.analyticsService.recordView({
      shopId,
      productId,
      customerId: body.customerId,
      sessionId: body.sessionId,
      durationSeconds: body.durationSeconds,
    }).catch(() => undefined);
  }
}
```

Note: `@Body()` needs to be added to imports — add it to the destructured import at the top.

- [ ] **Step 4.2: Update catalog.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [PricingModule, AnalyticsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
```

- [ ] **Step 4.3: Register ThrottlerModule in AppModule**

In `apps/api/src/app.module.ts`, add the import:
```typescript
import { ThrottlerModule } from '@nestjs/throttler';
```

In the `imports` array (add after `EventEmitterModule.forRoot(...)`):
```typescript
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
```

- [ ] **Step 4.4: Update controller spec to cover new endpoints**

In `apps/api/src/modules/catalog/catalog.controller.spec.ts`, add to the providers in `beforeAll`:
```typescript
{ provide: CatalogService, useValue: mockCatalogService },
```

Add mock at top:
```typescript
import { CatalogService } from './catalog.service';
import type { TenantConfigResponse, CatalogProductsResponse } from './catalog.service';

const mockTenantConfig: TenantConfigResponse = {
  primaryColor: '#B58A3C', logoUrl: null, appName: 'Test Shop', defaultLanguage: 'hi',
};
const mockProductsResponse: CatalogProductsResponse = {
  items: [], total: 0, page: 1,
};
const mockCatalogService = {
  getTenantConfig: vi.fn().mockResolvedValue(mockTenantConfig),
  getProducts:     vi.fn().mockResolvedValue(mockProductsResponse),
  getProduct:      vi.fn().mockRejectedValue(new NotFoundException()),
};
```

Add HTTP test cases:
```typescript
describe('GET /api/v1/catalog/tenant-config', () => {
  it('returns 400 when X-Shop-Slug header is missing', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/catalog/tenant-config')
      .expect(400);
  });

  it('returns tenant config with cache header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/catalog/tenant-config')
      .set('X-Shop-Slug', 'test-shop')
      .expect(200);

    expect(res.body.primaryColor).toBe('#B58A3C');
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
  });
});

describe('GET /api/v1/catalog/products', () => {
  it('returns 400 when X-Tenant-Id header is missing', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/catalog/products')
      .expect(400);
  });

  it('returns product listing with cache header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/catalog/products')
      .set('X-Tenant-Id', 'shop-uuid')
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=60');
  });
});
```

- [ ] **Step 4.5: Run all catalog tests**

```bash
cd C:/gs-cust-web && pnpm --filter @goldsmith/api test -- --run --reporter=verbose catalog
```

Expected: all catalog tests PASS.

- [ ] **Step 4.6: Run API typecheck**

```bash
cd C:/gs-cust-web && pnpm --filter @goldsmith/api typecheck
```

Expected: no errors.

- [ ] **Step 4.7: Commit**

```bash
git add apps/api/src/modules/catalog/ apps/api/src/app.module.ts
git commit -m "feat(catalog): wire catalog.controller.ts + CatalogService + throttler (class-level)"
```

---

## Task 5: Next.js scaffold (WS-B)

**Files:** All new files in `apps/customer-web/`

- [ ] **Step 5.1: Add dev task to turbo.json**

In `turbo.json`, add `"dev"` to the `tasks` object:
```json
"dev": { "cache": false, "persistent": true }
```

- [ ] **Step 5.2: Create apps/customer-web/package.json**

```json
{
  "name": "@goldsmith/customer-web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint"
  },
  "dependencies": {
    "@goldsmith/ui-tokens": "workspace:*",
    "next": "14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.4.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.3"
  }
}
```

- [ ] **Step 5.3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5.4: Create next.config.ts**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@goldsmith/ui-tokens'],
  experimental: {
    serverComponentsExternalPackages: [],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.blob.core.windows.net' },
      { protocol: 'https', hostname: 'ik.imagekit.io' },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 5.5: Create postcss.config.js**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5.6: Create tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';
import { colors } from '@goldsmith/ui-tokens';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:    'var(--primary-color, #B58A3C)',
        bg:         colors.bg,
        ink:        colors.ink,
        inkMute:    colors.inkMute,
        border:     colors.border,
        error:      colors.error,
        white:      colors.white,
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Georgia', 'serif'],
        body:    ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5.7: Install deps in worktree**

```bash
cd C:/gs-cust-web && pnpm install
```

Expected: `@goldsmith/customer-web` added to workspace.

- [ ] **Step 5.8: Commit scaffold**

```bash
git add turbo.json apps/customer-web/package.json apps/customer-web/tsconfig.json apps/customer-web/next.config.ts apps/customer-web/postcss.config.js apps/customer-web/tailwind.config.ts pnpm-lock.yaml
git commit -m "feat(customer-web): Next.js 14 App Router scaffold with Tailwind + ui-tokens"
```

---

## Task 6: lib/api.ts + lib/theme.ts

**Files:**
- Create: `apps/customer-web/lib/api.ts`
- Create: `apps/customer-web/lib/theme.ts`

- [ ] **Step 6.1: Create lib/api.ts**

```typescript
// Typed fetch helpers for public catalog API.
// API_URL is server-side only (http://localhost:3001 in dev).

import type { TenantConfigResponse, CatalogProductsResponse, CatalogProduct } from '../../api/src/modules/catalog/catalog.service';
import type { PublicRatesResponse } from '../../api/src/modules/catalog/catalog.controller';

// Re-export for use in server components
export type { TenantConfigResponse, CatalogProductsResponse, CatalogProduct, PublicRatesResponse };

const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';

export async function fetchTenantConfig(slug: string): Promise<TenantConfigResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/tenant-config`, {
      headers: { 'X-Shop-Slug': slug },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<TenantConfigResponse>;
  } catch {
    return null;
  }
}

export async function fetchPublicRates(): Promise<PublicRatesResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/rates`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<PublicRatesResponse>;
  } catch {
    return null;
  }
}

export async function fetchProducts(
  shopId: string,
  params: { categoryId?: string; search?: string; page?: number; limit?: number } = {},
): Promise<CatalogProductsResponse | null> {
  const qs = new URLSearchParams();
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.search)     qs.set('search', params.search);
  if (params.page)       qs.set('page', String(params.page));
  if (params.limit)      qs.set('limit', String(params.limit));

  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/products?${qs.toString()}`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<CatalogProductsResponse>;
  } catch {
    return null;
  }
}

export async function fetchProduct(productId: string, shopId: string): Promise<CatalogProduct | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/catalog/products/${productId}`, {
      headers: { 'X-Tenant-Id': shopId },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<CatalogProduct>;
  } catch {
    return null;
  }
}
```

Note: If the cross-package type import causes build issues (circular monorepo dep), copy the types inline into `lib/api.ts` instead.

- [ ] **Step 6.2: Create lib/theme.ts**

```typescript
// Helper utilities for the white-label theme applied in layout.tsx

export interface ThemeVars {
  '--primary-color': string;
}

export function buildThemeStyle(primaryColor: string): React.CSSProperties {
  return {
    ['--primary-color' as string]: primaryColor,
  } as React.CSSProperties;
}

// Maps API metal/purity strings to Hindi display labels
export const METAL_LABELS: Record<string, string> = {
  GOLD:   'सोना',
  SILVER: 'चाँदी',
  PLATINUM: 'प्लेटिनम',
};

export const PURITY_LABELS: Record<string, string> = {
  GOLD_24K:   '24K',
  GOLD_22K:   '22K',
  GOLD_20K:   '20K',
  GOLD_18K:   '18K',
  GOLD_14K:   '14K',
  SILVER_999: '999',
  SILVER_925: '925',
};

export function metalLabel(metal: string): string {
  return METAL_LABELS[metal] ?? metal;
}

export function purityLabel(purity: string): string {
  const metal = METAL_LABELS[purity.split('_')[0]] ?? '';
  const k = PURITY_LABELS[purity] ?? purity;
  return `${metal} ${k}`.trim();
}
```

- [ ] **Step 6.3: Commit**

```bash
git add apps/customer-web/lib/
git commit -m "feat(customer-web): lib/api.ts typed fetch helpers + lib/theme.ts Hindi labels"
```

---

## Task 7: app/layout.tsx — root layout with theme injection

**Files:**
- Create: `apps/customer-web/app/globals.css`
- Create: `apps/customer-web/app/layout.tsx`
- Create: `apps/customer-web/app/not-found.tsx`
- Create: `apps/customer-web/app/error.tsx`

- [ ] **Step 7.1: Create globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary-color: #B58A3C;
  --font-heading: 'Yatra One', Georgia, serif;
  --font-body: 'Noto Sans Devanagari', system-ui, sans-serif;
}

body {
  background-color: #F5EDDD;
  color: #1E2440;
  font-family: var(--font-body);
}

/* Focus ring — WCAG 2.1 AA */
:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
```

- [ ] **Step 7.2: Create app/layout.tsx**

```typescript
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Yatra_One, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';
import { fetchTenantConfig } from '@/lib/api';
import { buildThemeStyle } from '@/lib/theme';

// Never import Inter or Space Grotesk
const yatraOne = Yatra_One({
  weight: '400',
  subsets: ['devanagari', 'latin'],
  variable: '--font-heading',
  display: 'swap',
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  weight: ['400', '500', '600'],
  subsets: ['devanagari'],
  variable: '--font-body',
  display: 'swap',
});

// Resolve shop slug: header from middleware first, env var fallback
function resolveSlug(): string | null {
  const headersList = headers();
  return headersList.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

export async function generateMetadata(): Promise<Metadata> {
  const slug = resolveSlug();
  if (!slug) return { title: 'आभूषण' };
  const config = await fetchTenantConfig(slug);
  return {
    title: config?.appName ?? 'आभूषण',
    description: `${config?.appName ?? 'आभूषण'} — श्रेष्ठ आभूषण, विश्वसनीय सेवा`,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const slug = resolveSlug();

  // No slug → shop unavailable
  if (!slug) {
    return (
      <html lang="hi" className={`${yatraOne.variable} ${notoSansDevanagari.variable}`}>
        <body>
          <main className="flex min-h-screen items-center justify-center bg-bg p-8">
            <p className="font-body text-ink text-lg">यह दुकान उपलब्ध नहीं है।</p>
          </main>
        </body>
      </html>
    );
  }

  const config = await fetchTenantConfig(slug);

  if (!config) {
    return (
      <html lang="hi" className={`${yatraOne.variable} ${notoSansDevanagari.variable}`}>
        <body>
          <main className="flex min-h-screen items-center justify-center bg-bg p-8">
            <p className="font-body text-ink text-lg">यह दुकान उपलब्ध नहीं है।</p>
          </main>
        </body>
      </html>
    );
  }

  // Validate logo URL — only allow https:// to prevent CSS injection
  const safeLogoUrl =
    config.logoUrl && config.logoUrl.startsWith('https://') ? config.logoUrl : null;

  return (
    <html
      lang={config.defaultLanguage}
      className={`${yatraOne.variable} ${notoSansDevanagari.variable}`}
      style={buildThemeStyle(config.primaryColor)}
    >
      <body className="bg-bg text-ink min-h-screen font-body">
        {/* Shop logo — in <head> equivalent via metadata, and here for skip-nav */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-primary text-white px-4 py-2 rounded z-50">
          मुख्य सामग्री पर जाएं
        </a>
        <header className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            {safeLogoUrl && (
              <img
                src={safeLogoUrl}
                alt={`${config.appName} का लोगो`}
                className="h-10 w-auto object-contain"
              />
            )}
            <span className="font-heading text-xl text-ink">{config.appName}</span>
          </div>
        </header>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 7.3: Create not-found.tsx**

```typescript
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-heading text-3xl text-ink">उत्पाद नहीं मिला</h1>
      <p className="font-body text-inkMute">यह उत्पाद उपलब्ध नहीं है।</p>
      <a href="/products" className="font-body text-primary underline">
        ← सभी उत्पाद देखें
      </a>
    </div>
  );
}
```

- [ ] **Step 7.4: Create error.tsx**

```typescript
'use client';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-heading text-2xl text-error">कुछ गलत हो गया</h1>
      <p className="font-body text-inkMute">कृपया पुनः प्रयास करें।</p>
      <button
        onClick={reset}
        className="bg-primary text-white font-body px-6 py-2 rounded-md hover:opacity-90 focus-visible:outline-2"
        aria-label="पुनः प्रयास करें"
      >
        पुनः प्रयास करें
      </button>
    </div>
  );
}
```

- [ ] **Step 7.5: Commit**

```bash
git add apps/customer-web/app/
git commit -m "feat(customer-web): root layout — theme injection, Yatra One + Noto Sans Devanagari, WCAG skip-nav"
```

---

## Task 8: Shared components

**Files:** `apps/customer-web/components/`

- [ ] **Step 8.1: Create GoldTexturePlaceholder.tsx**

```typescript
// Domain-appropriate product image placeholder — warm gold texture, not generic grey
export function GoldTexturePlaceholder({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label="उत्पाद की छवि उपलब्ध नहीं"
    >
      <defs>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#D4A853" />
          <stop offset="50%"  stopColor="#B58A3C" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <pattern id="pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="url(#gold)" opacity="0.15" />
          <line x1="0" y1="40" x2="40" y2="0" stroke="#B58A3C" strokeWidth="0.5" opacity="0.3" />
        </pattern>
      </defs>
      <rect width="400" height="400" fill="#F5EDDD" />
      <rect width="400" height="400" fill="url(#pattern)" />
      <text x="200" y="210" textAnchor="middle" fontSize="48" fill="#B58A3C" opacity="0.5" fontFamily="serif">
        ◈
      </text>
    </svg>
  );
}
```

- [ ] **Step 8.2: Create HuidBadge.tsx**

```typescript
interface HuidBadgeProps {
  huid: string | null;
  exemptionCategory: string;
}

export function HuidBadge({ huid, exemptionCategory }: HuidBadgeProps) {
  if (huid) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-body text-primary border border-primary/30"
        title={`HUID: ${huid}`}
        aria-label={`हॉलमार्क प्रमाणित — HUID: ${huid}`}
      >
        हॉलमार्क ✓ <span className="font-mono">{huid}</span>
      </span>
    );
  }

  if (exemptionCategory === 'kundan_polki_jadau') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-border px-2 py-0.5 text-xs font-body text-inkMute">
        कुंदन/पोलकी (HUID छूट)
      </span>
    );
  }

  if (exemptionCategory === 'under_2g') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-border px-2 py-0.5 text-xs font-body text-inkMute">
        2ग्राम से कम (HUID छूट)
      </span>
    );
  }

  return null;
}
```

- [ ] **Step 8.3: Create EstimatedPriceBadge.tsx**

```typescript
interface EstimatedPriceBadgeProps {
  priceAvailable: boolean;
  totalFormatted?: string;
  compact?: boolean;
}

export function EstimatedPriceBadge({ priceAvailable, totalFormatted, compact = false }: EstimatedPriceBadgeProps) {
  if (!priceAvailable || !totalFormatted) {
    return (
      <span className="font-body text-sm text-inkMute" aria-label="मूल्य के लिए संपर्क करें">
        मूल्य के लिए संपर्क करें
      </span>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-col">
        <span className="font-body font-semibold text-ink text-base">{totalFormatted}</span>
        <span className="font-body text-xs text-inkMute">अनुमानित</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-body font-semibold text-ink text-xl">{totalFormatted}</span>
      <span className="font-body text-xs text-inkMute">
        अनुमानित मूल्य
        <span
          className="ml-1 cursor-help underline decoration-dotted"
          title="पत्थर और अन्य शुल्क अलग से लागू हो सकते हैं"
          aria-label="पत्थर और अन्य शुल्क अलग से लागू हो सकते हैं"
        >
          (?)
        </span>
      </span>
    </div>
  );
}
```

- [ ] **Step 8.4: Create WishlistButton.tsx**

```typescript
'use client';
import { useState } from 'react';

export function WishlistButton({ productName }: { productName: string }) {
  const [added, setAdded] = useState(false);

  const handleClick = () => {
    setAdded(true);
    // Stub — Wave 7 will wire persistence
    setTimeout(() => setAdded(false), 3000);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full rounded-md border border-primary bg-white px-6 py-3 font-body text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary transition-colors"
      aria-label={`${productName} को इच्छा सूची में जोड़ें`}
      aria-pressed={added}
    >
      {added ? '✓ इच्छा सूची में जोड़ा गया' : 'इच्छा सूची में जोड़ें'}
    </button>
  );
}
```

- [ ] **Step 8.5: Create GoldRateCard.tsx**

```typescript
import type { PublicRatesResponse } from '@/lib/api';

export function GoldRateCard({ rates }: { rates: PublicRatesResponse | null }) {
  if (!rates) {
    return (
      <div className="rounded-lg border border-border bg-white/60 p-4" aria-label="सोने की दर उपलब्ध नहीं">
        <p className="font-body text-sm text-inkMute text-center">दर अभी उपलब्ध नहीं है</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-border bg-white/80 backdrop-blur-sm p-4 shadow-sm"
      role="region"
      aria-label="आज की सोने-चाँदी की दरें"
    >
      <h2 className="font-heading text-lg text-ink mb-3">
        आज की दरें {rates.stale && <span className="font-body text-xs text-inkMute ml-1">(पुरानी)</span>}
      </h2>
      <div className="grid grid-cols-3 gap-3" role="list">
        {[
          { label: 'सोना 24K', rate: rates.GOLD_24K },
          { label: 'सोना 22K', rate: rates.GOLD_22K },
          { label: 'चाँदी 999', rate: rates.SILVER_999 },
        ].map(({ label, rate }) => (
          <div key={label} className="flex flex-col" role="listitem">
            <span className="font-body text-xs text-inkMute">{label}</span>
            <span className="font-body font-semibold text-ink text-sm" aria-label={`${label}: ${rate.formattedINR} प्रति ग्राम`}>
              {rate.formattedINR}
            </span>
            <span className="font-body text-xs text-inkMute">/ग्राम</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8.6: Create ProductCard.tsx**

```typescript
import { GoldTexturePlaceholder } from './GoldTexturePlaceholder';
import { HuidBadge } from './HuidBadge';
import { EstimatedPriceBadge } from './EstimatedPriceBadge';
import { metalLabel, purityLabel } from '@/lib/theme';
import type { CatalogProduct } from '@/lib/api';

export function ProductCard({ product }: { product: CatalogProduct }) {
  const isUnavailable = product.quantity === 0;

  return (
    <a
      href={`/products/${product.id}`}
      className="group block rounded-lg border border-border bg-white overflow-hidden hover:shadow-md transition-shadow focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={`${purityLabel(product.purity)} ${product.sku}${isUnavailable ? ' — उपलब्ध नहीं' : ''}`}
    >
      <div className="relative aspect-square bg-bg overflow-hidden">
        <GoldTexturePlaceholder className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {isUnavailable && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-ink/40"
            aria-hidden="true"
          >
            <span className="font-body text-white text-sm font-medium bg-ink/70 px-3 py-1 rounded">
              उपलब्ध नहीं
            </span>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        <p className="font-body text-sm font-medium text-ink">
          {purityLabel(product.purity)}
        </p>
        <p className="font-body text-xs text-inkMute">{product.sku}</p>
        <HuidBadge huid={product.huid} exemptionCategory={product.huidExemptionCategory} />
        <EstimatedPriceBadge
          priceAvailable={product.priceAvailable}
          totalFormatted={product.estimatedPrice?.totalFormatted}
          compact
        />
      </div>
    </a>
  );
}
```

- [ ] **Step 8.7: Create ProductGrid.tsx**

```typescript
import { ProductCard } from './ProductCard';
import type { CatalogProduct } from '@/lib/api';

interface ProductGridProps {
  products: CatalogProduct[];
  emptyMessage?: string;
}

export function ProductGrid({ products, emptyMessage = 'अभी कोई उत्पाद उपलब्ध नहीं है' }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8" aria-live="polite">
        <p className="font-body text-inkMute text-center">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      aria-label="उत्पाद सूची"
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

- [ ] **Step 8.8: Create CategorySidebar.tsx**

```typescript
interface CategorySidebarProps {
  selectedMetal?: string;
  baseHref: string;
}

const METAL_FILTERS = [
  { value: '',       label: 'सभी', ariaLabel: 'सभी उत्पाद' },
  { value: 'GOLD',   label: 'सोना', ariaLabel: 'सोने के आभूषण' },
  { value: 'SILVER', label: 'चाँदी', ariaLabel: 'चाँदी के आभूषण' },
];

export function CategorySidebar({ selectedMetal = '', baseHref }: CategorySidebarProps) {
  return (
    <nav aria-label="श्रेणी फ़िल्टर" className="flex flex-col gap-1">
      <h2 className="font-body text-xs font-semibold text-inkMute uppercase tracking-wide mb-2">
        श्रेणी
      </h2>
      {METAL_FILTERS.map(({ value, label, ariaLabel }) => {
        const href = value ? `${baseHref}?metal=${value}` : baseHref;
        const isActive = selectedMetal === value;
        return (
          <a
            key={value}
            href={href}
            className={`block rounded-md px-3 py-2 font-body text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-ink hover:bg-border/50'
            }`}
            aria-label={ariaLabel}
            aria-current={isActive ? 'page' : undefined}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 8.9: Commit components**

```bash
git add apps/customer-web/components/
git commit -m "feat(customer-web): shared components — ProductCard, GoldRateCard, HuidBadge, EstimatedPriceBadge, WishlistButton, CategorySidebar"
```

---

## Task 9: app/page.tsx — Homepage

**Files:**
- Create: `apps/customer-web/app/page.tsx`

- [ ] **Step 9.1: Create homepage**

The homepage needs the shop slug (for `X-Tenant-Id` to fetch products). Read from the same resolution logic as layout — `x-shop-slug` header → env var. Since we can't import `resolveSlug` from layout (server component tree), we re-read `headers()` + env var inline. We also need the shop's actual `id` (UUID) for the products API. Fetch it from `fetchTenantConfig`, which returns the appName but not the shopId. We need to extend `TenantConfigResponse` to include `shopId`.

**First, update the `TenantConfigResponse` in `catalog.service.ts` to include `shopId`:**

In `apps/api/src/modules/catalog/catalog.service.ts`, add `shopId` to `TenantConfigResponse`:
```typescript
export interface TenantConfigResponse {
  shopId:          string;   // ← add this
  primaryColor:    string;
  logoUrl:         string | null;
  appName:         string;
  defaultLanguage: string;
}
```

And update `getTenantConfig` to include `id`:
```typescript
return {
  shopId:          row.id,   // ← add this
  primaryColor:    (row.config?.['primaryColor'] as string | undefined) ?? '#B58A3C',
  logoUrl:         row.logo_url ?? null,
  appName:         row.display_name,
  defaultLanguage: (row.config?.['defaultLanguage'] as string | undefined) ?? 'hi',
};
```

Update the test mock to include `shopId: 'shop-1'` in each test case that checks the response shape.

**Now create the homepage:**

```typescript
import { headers } from 'next/headers';
import { fetchTenantConfig, fetchPublicRates, fetchProducts } from '@/lib/api';
import { GoldRateCard } from '@/components/GoldRateCard';
import { ProductGrid } from '@/components/ProductGrid';

function resolveSlugFromContext(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

export default async function HomePage() {
  const slug = resolveSlugFromContext();

  if (!slug) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="font-body text-inkMute">दुकान नहीं मिली।</p>
      </div>
    );
  }

  const [config, rates, productsData] = await Promise.all([
    fetchTenantConfig(slug),
    fetchPublicRates(),
    // We need shopId — fetch config first if null (config may already be cached from layout)
    Promise.resolve(null as Awaited<ReturnType<typeof fetchProducts>>),
  ]);

  // Fetch featured products using shopId from config
  const featuredProducts = config
    ? await fetchProducts(config.shopId, { limit: 6 })
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Hero */}
      <section aria-labelledby="hero-heading" className="text-center py-8">
        <h1 id="hero-heading" className="font-heading text-4xl text-ink mb-3">
          {config?.appName ?? 'आभूषण'}
        </h1>
        <p className="font-body text-lg text-inkMute">
          श्रेष्ठ आभूषण, विश्वसनीय सेवा
        </p>
      </section>

      {/* Live gold rate card */}
      <section aria-labelledby="rates-heading">
        <h2 id="rates-heading" className="sr-only">आज की दरें</h2>
        <GoldRateCard rates={rates} />
      </section>

      {/* Featured products */}
      <section aria-labelledby="featured-heading">
        <h2 id="featured-heading" className="font-heading text-2xl text-ink mb-4">
          विशेष आभूषण
        </h2>
        <ProductGrid
          products={featuredProducts?.items ?? []}
          emptyMessage="अभी कोई उत्पाद उपलब्ध नहीं है"
        />
        {(featuredProducts?.total ?? 0) > 6 && (
          <div className="mt-6 text-center">
            <a
              href="/products"
              className="inline-block font-body text-primary underline hover:opacity-80 focus-visible:outline-2 focus-visible:outline-primary"
            >
              सभी उत्पाद देखें →
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 9.2: Commit**

```bash
git add apps/customer-web/app/page.tsx apps/api/src/modules/catalog/catalog.service.ts apps/api/src/modules/catalog/catalog.service.spec.ts
git commit -m "feat(customer-web): homepage — hero, gold rate card, featured products grid"
```

---

## Task 10: app/products/page.tsx — Product Listing

**Files:**
- Create: `apps/customer-web/app/products/page.tsx`

- [ ] **Step 10.1: Create product listing page**

```typescript
import { headers } from 'next/headers';
import { fetchTenantConfig, fetchProducts } from '@/lib/api';
import { ProductGrid } from '@/components/ProductGrid';
import { CategorySidebar } from '@/components/CategorySidebar';

function resolveSlugFromContext(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

interface SearchParams {
  page?: string;
  search?: string;
  metal?: string;
  categoryId?: string;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const slug = resolveSlugFromContext();
  if (!slug) return <p className="p-8 font-body text-inkMute text-center">दुकान नहीं मिली।</p>;

  const config = await fetchTenantConfig(slug);
  if (!config) return <p className="p-8 font-body text-inkMute text-center">दुकान उपलब्ध नहीं है।</p>;

  const page      = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const search    = searchParams.search?.trim();
  const metal     = searchParams.metal;
  const categoryId = searchParams.categoryId;

  const productsData = await fetchProducts(config.shopId, {
    categoryId,
    search,
    page,
    limit: 12,
  });

  const items    = productsData?.items ?? [];
  const total    = productsData?.total ?? 0;
  const lastPage = Math.ceil(total / 12) || 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-heading text-3xl text-ink mb-6">आभूषण संग्रह</h1>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block w-40 shrink-0" aria-label="फ़िल्टर">
          <CategorySidebar selectedMetal={metal ?? ''} baseHref="/products" />
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Search */}
          <form role="search" aria-label="उत्पाद खोजें" className="flex gap-2">
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="SKU, धातु, शुद्धता खोजें..."
              className="flex-1 rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink placeholder:text-inkMute focus:outline-2 focus:outline-primary"
              aria-label="उत्पाद खोज"
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 font-body text-sm text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
            >
              खोजें
            </button>
          </form>

          {/* Results count */}
          <p className="font-body text-xs text-inkMute" aria-live="polite">
            {total} उत्पाद मिले
          </p>

          <ProductGrid products={items} />

          {/* Pagination */}
          {lastPage > 1 && (
            <nav aria-label="पृष्ठ नेवीगेशन" className="flex justify-center gap-2 mt-4">
              {page > 1 && (
                <a
                  href={`/products?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ''}${metal ? `&metal=${metal}` : ''}`}
                  className="font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label="पिछला पृष्ठ"
                >
                  ← पिछला
                </a>
              )}
              <span className="font-body text-sm text-inkMute" aria-current="page">
                {page} / {lastPage}
              </span>
              {page < lastPage && (
                <a
                  href={`/products?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ''}${metal ? `&metal=${metal}` : ''}`}
                  className="font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label="अगला पृष्ठ"
                >
                  अगला →
                </a>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 10.2: Commit**

```bash
git add apps/customer-web/app/products/page.tsx
git commit -m "feat(customer-web): product listing — category sidebar, search, pagination, WCAG"
```

---

## Task 11: app/products/[id]/page.tsx — Product Detail

**Files:**
- Create: `apps/customer-web/app/products/[id]/page.tsx`

- [ ] **Step 11.1: Create product detail page**

```typescript
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { fetchTenantConfig, fetchProduct } from '@/lib/api';
import { HuidBadge } from '@/components/HuidBadge';
import { EstimatedPriceBadge } from '@/components/EstimatedPriceBadge';
import { WishlistButton } from '@/components/WishlistButton';
import { GoldTexturePlaceholder } from '@/components/GoldTexturePlaceholder';
import { purityLabel } from '@/lib/theme';

function resolveSlugFromContext(): string | null {
  const h = headers();
  return h.get('x-shop-slug') ?? process.env['NEXT_PUBLIC_SHOP_SLUG'] ?? null;
}

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const slug = resolveSlugFromContext();
  if (!slug) notFound();

  const config = await fetchTenantConfig(slug);
  if (!config) notFound();

  const product = await fetchProduct(params.id, config.shopId);
  if (!product) notFound();

  const isUnavailable = product.quantity === 0;
  const displayPurity = purityLabel(product.purity);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <a
        href="/products"
        className="inline-block font-body text-sm text-primary underline mb-6 focus-visible:outline-2 focus-visible:outline-primary"
        aria-label="सभी उत्पाद सूची पर वापस जाएं"
      >
        ← उत्पाद देखें
      </a>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product image */}
        <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-bg">
          <GoldTexturePlaceholder className="w-full h-full" />
          {isUnavailable && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-ink/40"
              aria-hidden="true"
            >
              <span className="font-body text-white text-lg font-medium">उपलब्ध नहीं</span>
            </div>
          )}
        </div>

        {/* Product details */}
        <div className="flex flex-col gap-4" aria-label="उत्पाद विवरण">
          <div>
            <h1 className="font-heading text-3xl text-ink">{displayPurity}</h1>
            <p className="font-body text-sm text-inkMute mt-1">SKU: {product.sku}</p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <HuidBadge huid={product.huid} exemptionCategory={product.huidExemptionCategory} />
            {isUnavailable && (
              <span
                className="inline-block rounded-full bg-error/10 px-2 py-0.5 text-xs font-body text-error border border-error/30"
                role="status"
                aria-label="यह उत्पाद अभी उपलब्ध नहीं है"
              >
                उपलब्ध नहीं
              </span>
            )}
          </div>

          {/* Weight */}
          <dl className="grid grid-cols-2 gap-2 font-body text-sm">
            <div>
              <dt className="text-inkMute">कुल वज़न</dt>
              <dd className="text-ink font-medium">{product.grossWeightG} ग्राम</dd>
            </div>
            <div>
              <dt className="text-inkMute">शुद्ध वज़न</dt>
              <dd className="text-ink font-medium">{product.netWeightG} ग्राम</dd>
            </div>
          </dl>

          {/* Estimated price */}
          <div className="border-t border-border pt-4">
            <EstimatedPriceBadge
              priceAvailable={product.priceAvailable}
              totalFormatted={product.estimatedPrice?.totalFormatted}
            />
          </div>

          {/* Wishlist stub */}
          {!isUnavailable && (
            <WishlistButton productName={displayPurity} />
          )}

          {/* Price disclaimer */}
          {product.priceAvailable && (
            <p className="font-body text-xs text-inkMute" role="note">
              * यह अनुमानित मूल्य है। पत्थर और अन्य शुल्क अलग से लागू हो सकते हैं।
              अंतिम मूल्य के लिए दुकान पर संपर्क करें।
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 11.2: Commit**

```bash
git add apps/customer-web/app/products/
git commit -m "feat(customer-web): product detail page — HUID badge, estimated price, wishlist stub, WCAG"
```

---

## Task 12: Final checks + Codex review

- [ ] **Step 12.1: API typecheck + lint + tests**

```bash
cd C:/gs-cust-web && pnpm --filter @goldsmith/api typecheck && pnpm --filter @goldsmith/api lint && pnpm --filter @goldsmith/api test -- --run
```

Expected: all green.

- [ ] **Step 12.2: Customer-web typecheck**

```bash
cd C:/gs-cust-web && pnpm --filter @goldsmith/customer-web typecheck
```

Expected: no errors.

- [ ] **Step 12.3: Boot the API and customer-web together**

In two terminals from `C:/gs-cust-web`:

Terminal 1 (API, assuming local Postgres + Redis running):
```bash
cd apps/api && pnpm start:dev
```

Terminal 2 (Web):
```bash
NEXT_PUBLIC_SHOP_SLUG=anchor-shop API_URL=http://localhost:3001 cd apps/customer-web && pnpm dev
```

Browse to `http://localhost:3000`:
- Verify Yatra One font renders for headings — NOT Inter
- Verify Noto Sans Devanagari for body text
- Verify Hindi labels on product cards (`सोना 22K`, `हॉलमार्क ✓`, etc.)
- Verify "अनुमानित मूल्य" appears on product cards with computed prices
- Verify ZERO "Goldsmith" or platform branding in page source (`Ctrl+U`)
- Verify background is `#F5EDDD` cream
- Navigate to `/products` — verify listing page loads
- Click a product — verify detail page loads with price breakdown

- [ ] **Step 12.4: Lighthouse a11y**

In Chrome DevTools → Lighthouse → Accessibility:
- Run on `/` (homepage)
- Run on `/products`
- Run on `/products/:id`

Expected: ≥ 90 on all pages.

- [ ] **Step 12.5: Codex review**

```bash
cd C:/gs-cust-web && codex review --base main
```

Expected: `.codex-review-passed` marker written.

- [ ] **Step 12.6: Final commit**

```bash
git add .codex-review-passed
git commit -m "chore(catalog): Codex review passed — Wave 5A"
```

- [ ] **Step 12.7: Push branch**

```bash
git push -u origin feat/epic7-customer-web-scaffold
```

---

## Self-Review Checklist

| Spec requirement | Covered in task |
|-----------------|-----------------|
| `catalog.service.ts` — `getTenantConfig` | Task 2 |
| `catalog.service.ts` — `getProducts` with N+1 prevention | Task 2 (Promise.all + mcMap) |
| `catalog.service.ts` — `getProduct` | Task 2 |
| `getProducts` — purity guard (`priceAvailable: false`) | Task 2 + Task 3 (tests) |
| `getProducts` — zero weight guard | Task 2 (try/catch) + Task 3 (tests) |
| `getProducts` — making charge fallback chain | Task 2 (override → map → '12.00') + Task 3 (tests) |
| `shops.config` null-safe access | Task 2 (`config?.['key']`) |
| `bySlug` → ACTIVE shops only | Task 1 |
| Throttler at CatalogController class level | Task 4 |
| `GET /catalog/tenant-config` — 400 on missing slug | Task 4 |
| `GET /catalog/products/:id` — 400 on missing tenant | Task 4 |
| Cache-Control headers on all 3 endpoints | Task 4 |
| `logo_url` XSS — https:// validation | Task 7 (layout.tsx) |
| `fetch` with `{ next: { revalidate: 3600 } }` for tenant config | Task 6 (lib/api.ts) |
| Yatra One + Noto Sans Devanagari — never Inter | Task 7 |
| Zero Goldsmith branding | Task 7 + all WS-C tasks |
| `अनुमानित मूल्य` label on estimated prices | Task 8 (EstimatedPriceBadge) |
| `उपलब्ध नहीं` badge for quantity=0 | Task 8 (ProductCard) + Task 11 |
| Wishlist stub → toast | Task 8 (WishlistButton) |
| WCAG 2.1 AA — skip-nav, ARIA labels, focus rings | Task 7 + all components |
| Homepage hero + rates + featured products | Task 9 |
| Product listing — category sidebar, search, pagination | Task 10 |
| Product detail — HUID badge, price, wishlist | Task 11 |
| Codex review | Task 12 |
