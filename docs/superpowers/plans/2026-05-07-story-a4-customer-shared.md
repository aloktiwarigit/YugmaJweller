# Story A4: packages/customer-shared Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `packages/customer-shared` — a zero-peer-dep workspace package that centralises shared TypeScript types, format helpers, storefront nav data, catalog filter constants, and SVG illustration fallbacks consumed by both `apps/customer-web` and `apps/customer-mobile`.

**Architecture:** Source-first package (no build step), mirroring `packages/ui-tokens`. Types are migrated from inline definitions in `apps/customer-web/lib/api.ts`, `apps/customer-web/lib/theme.ts`, and `apps/customer-mobile/src/api/endpoints.ts` into the new package; both apps update their imports. New Phase-B-ready types (`CatalogProductCard` with `primaryImage`, `CatalogProductDetail`, `CatalogImage`, `Collection`) are defined here so Phase B API work can match them without a schema migration. `StorefrontConfig` is re-exported from `@goldsmith/shared` (A5 has shipped).

**Tech Stack:** TypeScript source-first (no bundler), Vitest, pnpm workspace `workspace:*` references, Devanagari Hindi-first nav copy, inline SVG (viewBox 800×1000, cream `#F5EDDD` bg, aged-gold `#B58A3C` lines).

---

## Pre-flight

Before writing any code, verify baseline typechecks pass:

```bash
cd C:\gs-stf-4
pnpm install --frozen-lockfile
pnpm --filter @goldsmith/customer-web typecheck 2>&1 | tail -5
pnpm --filter @goldsmith/customer-mobile typecheck 2>&1 | tail -5
```

Both should exit 0 or show only pre-existing worktree-dep errors. Record which errors exist now so you can distinguish new regressions.

---

## File Map

### Create
| File | Responsibility |
|---|---|
| `packages/customer-shared/package.json` | Package manifest, workspace dep on @goldsmith/shared |
| `packages/customer-shared/tsconfig.json` | Extends tsconfig.base.json, includes src + test |
| `packages/customer-shared/src/index.ts` | Public barrel — re-exports everything |
| `packages/customer-shared/src/catalog-types.ts` | All catalog response interfaces (existing + new Phase B shapes) |
| `packages/customer-shared/src/storefront-types.ts` | StorefrontConfig re-export + HomeSectionPayload |
| `packages/customer-shared/src/format.ts` | formatInrFromPaise, productDisplayName |
| `packages/customer-shared/src/catalog-filters.ts` | PRICE_BANDS, CATALOG_STYLES, CATALOG_OCCASIONS, CATALOG_GIFT_PERSONAS, CATALOG_SORTS, PURITY_FILTERS, buildProductsHref |
| `packages/customer-shared/src/storefront-nav.ts` | STOREFRONT_BROWSE_NAV, MEGA_MENU_CONTENT, STOREFRONT_CATEGORY_TILES, STOREFRONT_OCCASION_TILES, STOREFRONT_GIFT_PERSONAS |
| `packages/customer-shared/src/illustrations/ring.svg` | Ring SVG fallback |
| `packages/customer-shared/src/illustrations/earring.svg` | Earring SVG fallback |
| `packages/customer-shared/src/illustrations/pendant.svg` | Pendant SVG fallback |
| `packages/customer-shared/src/illustrations/bangle.svg` | Bangle SVG fallback |
| `packages/customer-shared/src/illustrations/necklace.svg` | Necklace SVG fallback |
| `packages/customer-shared/src/illustrations/silver.svg` | Silver/generic SVG fallback |
| `packages/customer-shared/src/illustrations/index.ts` | SVG string exports + categoryToFallbackSvg() |
| `packages/customer-shared/test/format.test.ts` | Unit tests for format.ts |
| `packages/customer-shared/test/catalog-filters.test.ts` | Unit tests for catalog-filters.ts |
| `packages/customer-shared/test/illustrations.test.ts` | Unit tests for categoryToFallbackSvg |

### Modify
| File | Change |
|---|---|
| `apps/customer-web/package.json` | Add `@goldsmith/customer-shared: workspace:*` dep |
| `apps/customer-web/lib/api.ts` | Remove inline type definitions; import from @goldsmith/customer-shared |
| `apps/customer-web/lib/theme.ts` | Remove METAL_LABELS, PURITY_LABELS, metalLabel, purityLabel; import from @goldsmith/customer-shared |
| `apps/customer-mobile/package.json` | Add `@goldsmith/customer-shared: workspace:*` dep |
| `apps/customer-mobile/src/api/endpoints.ts` | Remove inline type duplicates; import from @goldsmith/customer-shared |

---

## Task 1: WS-A — Package scaffold + catalog types + barrel

**Files:**
- Create: `packages/customer-shared/package.json`
- Create: `packages/customer-shared/tsconfig.json`
- Create: `packages/customer-shared/src/catalog-types.ts`
- Create: `packages/customer-shared/src/storefront-types.ts`
- Create: `packages/customer-shared/src/index.ts`

- [ ] **Step 1: Create package.json**

`packages/customer-shared/package.json`:

```json
{
  "name": "@goldsmith/customer-shared",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run"
  },
  "dependencies": {
    "@goldsmith/shared": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^1.4.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

`packages/customer-shared/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*", "test/**/*"] }
```

- [ ] **Step 3: Create catalog-types.ts**

`packages/customer-shared/src/catalog-types.ts`:

```ts
// Catalog response types — shared between customer-web and customer-mobile.
// Types prefixed Catalog* are the current API contract.
// CatalogProductCard / CatalogProductDetail / CatalogImage are Phase-B-ready
// shapes that add primaryImage once B3 ships the join in catalog list responses.

export interface TenantConfigResponse {
  shopId:          string;
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

// Phase 1 product shape (no primaryImage — added in Phase B B3)
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

export interface PublicRateEntry {
  perGramRupees: string;
  formattedINR:  string;
  fetchedAt:     string;
}

export interface PublicRatesResponse {
  GOLD_24K:   PublicRateEntry;
  GOLD_22K:   PublicRateEntry;
  SILVER_999: PublicRateEntry;
  stale:      boolean;
  source:     string;
  refreshedAt: string;
}

export interface ReviewItem {
  id:                string;
  rating:            number;
  reviewText:        string | null;
  customerFirstName: string | null;
  createdAt:         string;
  isPubliclyVisible?: boolean;
}

export interface ReviewsResponse {
  reviews:       ReviewItem[];
  averageRating: number | null;
  total:         number;
}

export interface PublicImageItem {
  id:              string;
  alt_text:        string | null;
  width:           number;
  height:          number;
  srcset:          string;
  default_url:     string;
  placeholder_url: string;
}

export interface HuidVerifyResult {
  verified:       boolean;
  huid:           string;
  certifyingBody: string;
}

// ─── Phase B ready types ───────────────────────────────────────────────────────
// These shapes match what B3 will return once primaryImage join lands in catalog.

export interface CatalogImage {
  url:            string;
  placeholderUrl: string;
  srcset:         string;
  width:          number;
  height:         number;
  alt:            string | null;
}

// Card-level shape (homepage, listing). No grossWeightG (detail-only).
export interface CatalogProductCard {
  id:                    string;
  sku:                   string;
  metal:                 'GOLD' | 'SILVER' | 'PLATINUM' | string;
  purity:                string;
  categoryId:            string | null;
  categoryName:          string | null;
  netWeightG:            string;
  huid:                  string | null;
  huidExemptionCategory: string | null;
  quantity:              number;
  priceAvailable:        boolean;
  estimatedPrice?:       EstimatedPrice;
  publishedAt:           string;
  primaryImage:          CatalogImage | null;
}

export interface CatalogProductDetail extends CatalogProductCard {
  grossWeightG:   string;
  occasion:       string[];
  giftPersona:    string[];
  collectionId:   string | null;
  images:         CatalogImage[];
}

export interface CategoryNode {
  id:           string;
  name:         string;
  slug:         string;
  productCount: number;
}

export interface Collection {
  id:           string;
  slug:         string;
  titleHi:      string;
  titleEn?:     string;
  subtitleHi?:  string;
  heroImage:    CatalogImage | null;
  productCount: number;
  isPremium:    boolean;
}
```

- [ ] **Step 4: Create storefront-types.ts**

`packages/customer-shared/src/storefront-types.ts`:

```ts
// Re-export StorefrontConfig type from @goldsmith/shared (A5 has shipped).
// Consumers import the Zod validator from @goldsmith/shared; this package
// only re-exports the inferred type for use in API response/request typing.
export type { StorefrontConfig } from '@goldsmith/shared';

export interface HomeSectionPayload {
  sectionKey: string;
  titleHi:    string;
  titleEn?:   string;
  items:      unknown[];
}
```

- [ ] **Step 5: Create barrel index.ts**

`packages/customer-shared/src/index.ts`:

```ts
export type {
  TenantConfigResponse,
  EstimatedPrice,
  CatalogProduct,
  CatalogProductsResponse,
  PublicRateEntry,
  PublicRatesResponse,
  ReviewItem,
  ReviewsResponse,
  PublicImageItem,
  HuidVerifyResult,
  CatalogImage,
  CatalogProductCard,
  CatalogProductDetail,
  CategoryNode,
  Collection,
} from './catalog-types';

export type {
  StorefrontConfig,
  HomeSectionPayload,
} from './storefront-types';

export {
  formatInrFromPaise,
  productDisplayName,
} from './format';

export {
  METAL_LABELS,
  PURITY_LABELS,
  metalLabel,
  purityLabel,
  PRICE_BANDS,
  PURITY_FILTERS,
  CATALOG_STYLES,
  CATALOG_OCCASIONS,
  CATALOG_GIFT_PERSONAS,
  CATALOG_SORTS,
  buildProductsHref,
} from './catalog-filters';

export {
  STOREFRONT_BROWSE_NAV,
  MEGA_MENU_CONTENT,
  STOREFRONT_CATEGORY_TILES,
  STOREFRONT_OCCASION_TILES,
  STOREFRONT_GIFT_PERSONAS,
} from './storefront-nav';
export type {
  NavItem,
  MegaMenuLink,
  MegaMenuPanel,
} from './storefront-nav';

export {
  categoryToFallbackSvg,
  RING_SVG,
  EARRING_SVG,
  PENDANT_SVG,
  BANGLE_SVG,
  NECKLACE_SVG,
  SILVER_SVG,
} from './illustrations';
```

- [ ] **Step 6: Run pnpm install + typecheck**

```bash
cd C:\gs-stf-4
pnpm install
pnpm --filter @goldsmith/customer-shared typecheck
```

Expected: format.ts / catalog-filters.ts / storefront-nav.ts / illustrations/index.ts don't exist yet — expect "Cannot find module" errors. That is the RED state. The types in catalog-types.ts and storefront-types.ts should be clean already.

- [ ] **Step 7: Commit scaffold**

```bash
cd C:\gs-stf-4
git add packages/customer-shared/
git commit -m "feat(ws-a): scaffold @goldsmith/customer-shared — package.json, tsconfig, catalog-types, barrel"
```

---

## Task 2: WS-B — format.ts helpers (TDD)

**Files:**
- Create: `packages/customer-shared/test/format.test.ts`
- Create: `packages/customer-shared/src/format.ts`

- [ ] **Step 1: Write failing tests**

`packages/customer-shared/test/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatInrFromPaise, productDisplayName } from '../src/format';

describe('formatInrFromPaise', () => {
  it('formats 500000 paise as ₹5,000', () => {
    expect(formatInrFromPaise(500_000)).toBe('₹5,000');
  });

  it('formats 100 paise as ₹1', () => {
    expect(formatInrFromPaise(100)).toBe('₹1');
  });

  it('formats 10000000 paise as ₹1,00,000 (Indian number system)', () => {
    // Intl.NumberFormat en-IN uses Indian lakh/crore grouping
    const result = formatInrFromPaise(10_000_000);
    expect(result).toMatch(/₹/);
    expect(result).toContain('1,00,000');
  });

  it('formats 0 paise as ₹0', () => {
    expect(formatInrFromPaise(0)).toBe('₹0');
  });
});

describe('productDisplayName', () => {
  it('returns category + metal + purity in Hindi-first format', () => {
    const result = productDisplayName({
      sku: 'SKU001',
      metal: 'GOLD',
      purity: 'GOLD_22K',
      categoryName: 'अंगूठी',
    });
    // Should include Hindi metal label + purity + category
    expect(result).toContain('सोना');
    expect(result).toContain('22K');
    expect(result).toContain('अंगूठी');
  });

  it('falls back to SKU when categoryName is null', () => {
    const result = productDisplayName({
      sku: 'RING-001',
      metal: 'SILVER',
      purity: 'SILVER_999',
      categoryName: null,
    });
    expect(result).toContain('चाँदी');
    expect(result).toContain('RING-001');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd C:\gs-stf-4
pnpm --filter @goldsmith/customer-shared test
```

Expected: `Cannot find module '../src/format'`

- [ ] **Step 3: Implement format.ts**

`packages/customer-shared/src/format.ts`:

```ts
export const METAL_LABELS: Record<string, string> = {
  GOLD:     'सोना',
  SILVER:   'चाँदी',
  PLATINUM: 'प्लेटिनम',
};

const PURITY_DISPLAY: Record<string, string> = {
  GOLD_24K:   '24K',
  GOLD_22K:   '22K',
  GOLD_20K:   '20K',
  GOLD_18K:   '18K',
  GOLD_14K:   '14K',
  SILVER_999: '999',
  SILVER_925: '925',
};

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function productDisplayName(product: {
  sku:          string;
  metal:        string;
  purity:       string;
  categoryName: string | null;
}): string {
  const metal    = METAL_LABELS[product.metal] ?? product.metal;
  const purity   = PURITY_DISPLAY[product.purity] ?? product.purity;
  const category = product.categoryName ?? product.sku;
  return `${purity} ${metal} ${category}`;
}
```

Note: `METAL_LABELS` lives in `format.ts` because it's required by `productDisplayName`. `catalog-filters.ts` re-exports it in Task 3 so the barrel index stays clean.

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @goldsmith/customer-shared test -- test/format.test.ts
```

Expected: 6 tests passed.

- [ ] **Step 5: Commit**

```bash
cd C:\gs-stf-4
git add packages/customer-shared/src/format.ts packages/customer-shared/test/format.test.ts
git commit -m "feat(ws-b): formatInrFromPaise + productDisplayName — 6 unit tests green"
```

---

## Task 3: WS-B — catalog-filters.ts (TDD)

**Files:**
- Create: `packages/customer-shared/test/catalog-filters.test.ts`
- Create: `packages/customer-shared/src/catalog-filters.ts`

- [ ] **Step 1: Write failing tests**

`packages/customer-shared/test/catalog-filters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  PRICE_BANDS,
  CATALOG_STYLES,
  CATALOG_OCCASIONS,
  CATALOG_SORTS,
  PURITY_FILTERS,
  METAL_LABELS,
  PURITY_LABELS,
  metalLabel,
  purityLabel,
  buildProductsHref,
} from '../src/catalog-filters';

describe('PRICE_BANDS', () => {
  it('has at least 4 bands', () => {
    expect(PRICE_BANDS.length).toBeGreaterThanOrEqual(4);
  });

  it('each band has labelHi, min, max', () => {
    for (const band of PRICE_BANDS) {
      expect(typeof band.labelHi).toBe('string');
      expect(typeof band.min).toBe('number');
      // max may be undefined for "above X" band
    }
  });
});

describe('CATALOG_STYLES', () => {
  it('includes DAILY_WEAR and BRIDAL', () => {
    expect(CATALOG_STYLES).toContain('DAILY_WEAR');
    expect(CATALOG_STYLES).toContain('BRIDAL');
  });
});

describe('metalLabel', () => {
  it('returns सोना for GOLD', () => {
    expect(metalLabel('GOLD')).toBe('सोना');
  });

  it('returns चाँदी for SILVER', () => {
    expect(metalLabel('SILVER')).toBe('चाँदी');
  });

  it('returns the raw value for unknown metal', () => {
    expect(metalLabel('TITANIUM')).toBe('TITANIUM');
  });
});

describe('purityLabel', () => {
  it('returns "सोना 22K" for GOLD_22K', () => {
    expect(purityLabel('GOLD_22K')).toBe('सोना 22K');
  });

  it('returns "चाँदी 999" for SILVER_999', () => {
    expect(purityLabel('SILVER_999')).toBe('चाँदी 999');
  });
});

describe('buildProductsHref', () => {
  it('returns /products with no params when called with empty object', () => {
    expect(buildProductsHref({})).toBe('/products');
  });

  it('serialises metal param', () => {
    expect(buildProductsHref({ metal: 'GOLD' })).toBe('/products?metal=GOLD');
  });

  it('serialises multiple params', () => {
    const href = buildProductsHref({ metal: 'GOLD', purity: 'GOLD_22K', sort: 'newest' });
    expect(href).toContain('metal=GOLD');
    expect(href).toContain('purity=GOLD_22K');
    expect(href).toContain('sort=newest');
    expect(href.startsWith('/products?')).toBe(true);
  });

  it('omits undefined/null params', () => {
    const href = buildProductsHref({ metal: 'GOLD', purity: undefined });
    expect(href).not.toContain('purity');
  });

  it('serialises priceMin and priceMax as strings', () => {
    const href = buildProductsHref({ priceMin: 100000, priceMax: 500000 });
    expect(href).toContain('priceMin=100000');
    expect(href).toContain('priceMax=500000');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @goldsmith/customer-shared test -- test/catalog-filters.test.ts
```

Expected: `Cannot find module '../src/catalog-filters'`

- [ ] **Step 3: Implement catalog-filters.ts**

`packages/customer-shared/src/catalog-filters.ts`:

```ts
import { METAL_LABELS, PURITY_LABELS } from './format-internals';

// Re-export so consumers only need one import for all label utilities
export { METAL_LABELS, PURITY_LABELS } from './format-internals';

export function metalLabel(metal: string): string {
  return METAL_LABELS[metal] ?? metal;
}

export function purityLabel(purity: string): string {
  const metalKey = purity.split('_')[0] ?? '';
  const metalHi  = METAL_LABELS[metalKey] ?? '';
  const k        = PURITY_LABELS[purity] ?? purity;
  return metalHi ? `${metalHi} ${k}` : k;
}

export interface PriceBand {
  labelHi: string;
  labelEn: string;
  min:     number;
  max?:    number;
}

export const PRICE_BANDS: PriceBand[] = [
  { labelHi: '₹10K तक',      labelEn: 'Under ₹10K',     min: 0,       max: 1_000_000 },
  { labelHi: '₹10K–₹25K',    labelEn: '₹10K–₹25K',      min: 1_000_000, max: 2_500_000 },
  { labelHi: '₹25K–₹50K',    labelEn: '₹25K–₹50K',      min: 2_500_000, max: 5_000_000 },
  { labelHi: '₹50K–₹1L',     labelEn: '₹50K–₹1L',       min: 5_000_000, max: 10_000_000 },
  { labelHi: '₹1L–₹5L',      labelEn: '₹1L–₹5L',        min: 10_000_000, max: 50_000_000 },
  { labelHi: '₹5L से ऊपर',   labelEn: 'Above ₹5L',      min: 50_000_000 },
];

export interface PurityFilter {
  labelHi: string;
  value:   string;
}

export const PURITY_FILTERS: PurityFilter[] = [
  { labelHi: 'सोना 24K',   value: 'GOLD_24K' },
  { labelHi: 'सोना 22K',   value: 'GOLD_22K' },
  { labelHi: 'सोना 18K',   value: 'GOLD_18K' },
  { labelHi: 'चाँदी 999',  value: 'SILVER_999' },
  { labelHi: 'चाँदी 925',  value: 'SILVER_925' },
];

export const CATALOG_STYLES = [
  'DAILY_WEAR', 'ENGAGEMENT', 'COUPLE', 'JHUMKA', 'STUDS',
  'HOOPS', 'DROP', 'STATEMENT', 'TEMPLE', 'BRIDAL', 'OFFICE', 'KIDS',
] as const;

export const CATALOG_OCCASIONS = [
  'WEDDING', 'ENGAGEMENT', 'ANNIVERSARY', 'FESTIVAL', 'DAILY',
  'GIFT', 'OFFICE', 'PARTY',
] as const;

export const CATALOG_GIFT_PERSONAS = [
  'MOTHER', 'SISTER', 'WIFE', 'BRIDE', 'SELF', 'FRIEND',
] as const;

export const CATALOG_SORTS = [
  'newest', 'priceAsc', 'priceDesc', 'trending', 'bestseller',
] as const;

export type CatalogSort = (typeof CATALOG_SORTS)[number];

export interface ProductsHrefParams {
  metal?:       string;
  purity?:      string;
  search?:      string;
  collection?:  string;
  style?:       string;
  occasion?:    string;
  giftPersona?: string;
  priceMin?:    number;
  priceMax?:    number;
  inStockOnly?: boolean;
  sort?:        CatalogSort;
  page?:        number;
}

export function buildProductsHref(params: ProductsHrefParams): string {
  const qs = new URLSearchParams();
  if (params.metal)       qs.set('metal', params.metal);
  if (params.purity)      qs.set('purity', params.purity);
  if (params.search)      qs.set('search', params.search);
  if (params.collection)  qs.set('collection', params.collection);
  if (params.style)       qs.set('style', params.style);
  if (params.occasion)    qs.set('occasion', params.occasion);
  if (params.giftPersona) qs.set('giftPersona', params.giftPersona);
  if (params.priceMin !== undefined) qs.set('priceMin', String(params.priceMin));
  if (params.priceMax !== undefined) qs.set('priceMax', String(params.priceMax));
  if (params.inStockOnly) qs.set('inStockOnly', 'true');
  if (params.sort)        qs.set('sort', params.sort);
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  const str = qs.toString();
  return `/products${str ? `?${str}` : ''}`;
}
```

Wait — `catalog-filters.ts` imports from `./format-internals`. But we put `METAL_LABELS` in `format.ts`. To avoid a circular dependency (format.ts and catalog-filters.ts both re-exporting the same thing), move the shared constants to a private internals file.

Update `packages/customer-shared/src/format.ts` — remove `METAL_LABELS` (it moves to a shared internals file):

```ts
// packages/customer-shared/src/format-internals.ts  (NEW — private)
export const METAL_LABELS: Record<string, string> = {
  GOLD:     'सोना',
  SILVER:   'चाँदी',
  PLATINUM: 'प्लेटिनम',
};

export const PURITY_DISPLAY: Record<string, string> = {
  GOLD_24K:   '24K',
  GOLD_22K:   '22K',
  GOLD_20K:   '20K',
  GOLD_18K:   '18K',
  GOLD_14K:   '14K',
  SILVER_999: '999',
  SILVER_925: '925',
};
```

Update `packages/customer-shared/src/format.ts` to import from `format-internals.ts`:

```ts
import { METAL_LABELS, PURITY_DISPLAY } from './format-internals';

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function productDisplayName(product: {
  sku:          string;
  metal:        string;
  purity:       string;
  categoryName: string | null;
}): string {
  const metal    = METAL_LABELS[product.metal] ?? product.metal;
  const purity   = PURITY_DISPLAY[product.purity] ?? product.purity;
  const category = product.categoryName ?? product.sku;
  return `${purity} ${metal} ${category}`;
}
```

Create the internals file, update format.ts, then proceed with catalog-filters.ts as specified above.

- [ ] **Step 4: Create format-internals.ts**

`packages/customer-shared/src/format-internals.ts`:

```ts
// Shared label constants — used by format.ts AND catalog-filters.ts.
// Single source of truth; both files import from here.

export const METAL_LABELS: Record<string, string> = {
  GOLD:     'सोना',
  SILVER:   'चाँदी',
  PLATINUM: 'प्लेटिनम',
};

// PURITY_LABELS doubles as both the display lookup and the filter value map.
// Note: PURITY_LABELS uses the full key (e.g. 'GOLD_22K'); the short display
// value ('22K') is used in metalLabel/purityLabel by stripping the metal prefix.
export const PURITY_LABELS: Record<string, string> = {
  GOLD_24K:   '24K',
  GOLD_22K:   '22K',
  GOLD_20K:   '20K',
  GOLD_18K:   '18K',
  GOLD_14K:   '14K',
  SILVER_999: '999',
  SILVER_925: '925',
};
```

- [ ] **Step 5: Update format.ts to import from format-internals**

Replace `packages/customer-shared/src/format.ts` content with:

```ts
import { METAL_LABELS, PURITY_LABELS } from './format-internals';

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function productDisplayName(product: {
  sku:          string;
  metal:        string;
  purity:       string;
  categoryName: string | null;
}): string {
  const metal    = METAL_LABELS[product.metal] ?? product.metal;
  const purity   = PURITY_LABELS[product.purity] ?? product.purity;
  const category = product.categoryName ?? product.sku;
  return `${purity} ${metal} ${category}`;
}
```

- [ ] **Step 6: Run tests — expect all pass**

```bash
pnpm --filter @goldsmith/customer-shared test
```

Expected: 14 tests pass (6 format + 8 catalog-filters).

- [ ] **Step 7: Commit**

```bash
cd C:\gs-stf-4
git add packages/customer-shared/src/format-internals.ts \
        packages/customer-shared/src/format.ts \
        packages/customer-shared/src/catalog-filters.ts \
        packages/customer-shared/test/catalog-filters.test.ts
git commit -m "feat(ws-b): catalog-filters — PRICE_BANDS, CATALOG_STYLES, purityLabel, buildProductsHref — 14 tests green"
```

---

## Task 4: WS-B — storefront-nav.ts

**Files:**
- Create: `packages/customer-shared/src/storefront-nav.ts`

No TDD for pure data constants — `pnpm typecheck` proves structural correctness.

- [ ] **Step 1: Create storefront-nav.ts**

`packages/customer-shared/src/storefront-nav.ts`:

```ts
// Hindi-first storefront navigation data.
// Shared between customer-web (mega-menu + mobile drawer) and customer-mobile
// (StorefrontDrawer accordion).
// NO "Goldsmith" brand string anywhere in this file — all copy is tenant-neutral.

export interface NavItem {
  key:     string;
  labelHi: string;
  labelEn: string;
  href:    string;
}

export interface MegaMenuLink {
  labelHi: string;
  labelEn?: string;
  href:    string;
}

export interface MegaMenuPanel {
  popular:    MegaMenuLink[];
  style:      MegaMenuLink[];
  metalPurity: MegaMenuLink[];
  priceBand:  MegaMenuLink[];
  occasion:   MegaMenuLink[];
}

export const STOREFRONT_BROWSE_NAV: NavItem[] = [
  { key: 'gold',     labelHi: 'सोना',    labelEn: 'Gold',      href: '/products?metal=GOLD' },
  { key: 'diamond',  labelHi: 'हीरा',    labelEn: 'Diamond',   href: '/products?search=diamond' },
  { key: 'silver',   labelHi: 'चाँदी',  labelEn: 'Silver',    href: '/products?metal=SILVER' },
  { key: 'rings',    labelHi: 'अंगूठी', labelEn: 'Rings',     href: '/products?search=ring' },
  { key: 'earrings', labelHi: 'झुमके',  labelEn: 'Earrings',  href: '/products?search=earring' },
  { key: 'pendants', labelHi: 'पेंडेंट', labelEn: 'Pendants', href: '/products?search=pendant' },
  { key: 'bangles',  labelHi: 'चूड़ी',  labelEn: 'Bangles',   href: '/products?search=bangle' },
  { key: 'collections', labelHi: 'कलेक्शन', labelEn: 'Collections', href: '/collections' },
];

export const MEGA_MENU_CONTENT: Record<string, MegaMenuPanel> = {
  gold: {
    popular: [
      { labelHi: 'अंगूठी',    labelEn: 'Rings',     href: '/products?metal=GOLD&search=ring' },
      { labelHi: 'झुमके',     labelEn: 'Earrings',  href: '/products?metal=GOLD&search=earring' },
      { labelHi: 'पेंडेंट',   labelEn: 'Pendants',  href: '/products?metal=GOLD&search=pendant' },
      { labelHi: 'मंगलसूत्र', labelEn: 'Mangalsutra', href: '/products?metal=GOLD&search=mangalsutra' },
      { labelHi: 'हार',       labelEn: 'Necklaces', href: '/products?metal=GOLD&search=necklace' },
    ],
    style: [
      { labelHi: 'रोज़ाना',   labelEn: 'Daily Wear',  href: '/products?metal=GOLD&style=DAILY_WEAR' },
      { labelHi: 'ब्राइडल',  labelEn: 'Bridal',      href: '/products?metal=GOLD&style=BRIDAL' },
      { labelHi: 'मंदिर',    labelEn: 'Temple',      href: '/products?metal=GOLD&style=TEMPLE' },
      { labelHi: 'ऑफिस',     labelEn: 'Office',      href: '/products?metal=GOLD&style=OFFICE' },
      { labelHi: 'स्टेटमेंट', labelEn: 'Statement',  href: '/products?metal=GOLD&style=STATEMENT' },
    ],
    metalPurity: [
      { labelHi: '24K सोना',  href: '/products?purity=GOLD_24K' },
      { labelHi: '22K सोना',  href: '/products?purity=GOLD_22K' },
      { labelHi: '18K सोना',  href: '/products?purity=GOLD_18K' },
      { labelHi: '14K सोना',  href: '/products?purity=GOLD_14K' },
      { labelHi: 'हीरे के साथ', labelEn: 'With Diamonds', href: '/products?metal=GOLD&search=diamond' },
    ],
    priceBand: [
      { labelHi: '₹10,000 तक',    href: '/products?metal=GOLD&priceMax=1000000' },
      { labelHi: '₹10K–₹25K',     href: '/products?metal=GOLD&priceMin=1000000&priceMax=2500000' },
      { labelHi: '₹25K–₹50K',     href: '/products?metal=GOLD&priceMin=2500000&priceMax=5000000' },
      { labelHi: '₹50K–₹1 लाख',  href: '/products?metal=GOLD&priceMin=5000000&priceMax=10000000' },
      { labelHi: '₹1 लाख से ऊपर', href: '/products?metal=GOLD&priceMin=10000000' },
    ],
    occasion: [
      { labelHi: 'शादी',       labelEn: 'Wedding',    href: '/products?metal=GOLD&occasion=WEDDING' },
      { labelHi: 'सगाई',       labelEn: 'Engagement', href: '/products?metal=GOLD&occasion=ENGAGEMENT' },
      { labelHi: 'त्यौहार',    labelEn: 'Festival',   href: '/products?metal=GOLD&occasion=FESTIVAL' },
      { labelHi: 'उपहार',      labelEn: 'Gift',       href: '/products?metal=GOLD&occasion=GIFT' },
      { labelHi: 'सालगिरह',   labelEn: 'Anniversary', href: '/products?metal=GOLD&occasion=ANNIVERSARY' },
    ],
  },
  silver: {
    popular: [
      { labelHi: 'चाँदी अंगूठी',  labelEn: 'Silver Rings',    href: '/products?metal=SILVER&search=ring' },
      { labelHi: 'चाँदी पायल',    labelEn: 'Anklets',         href: '/products?metal=SILVER&search=anklet' },
      { labelHi: 'चाँदी झुमके',   labelEn: 'Silver Earrings', href: '/products?metal=SILVER&search=earring' },
      { labelHi: 'चाँदी हार',     labelEn: 'Silver Necklaces', href: '/products?metal=SILVER&search=necklace' },
      { labelHi: 'चाँदी चूड़ी',   labelEn: 'Silver Bangles',  href: '/products?metal=SILVER&search=bangle' },
    ],
    style: [
      { labelHi: 'रोज़ाना',  labelEn: 'Daily Wear', href: '/products?metal=SILVER&style=DAILY_WEAR' },
      { labelHi: 'मंदिर',   labelEn: 'Temple',     href: '/products?metal=SILVER&style=TEMPLE' },
      { labelHi: 'ऑक्सीडाइज़्ड', labelEn: 'Oxidised', href: '/products?metal=SILVER&search=oxidised' },
      { labelHi: 'सादा',    labelEn: 'Plain',      href: '/products?metal=SILVER&style=OFFICE' },
      { labelHi: 'पारम्परिक', labelEn: 'Traditional', href: '/products?metal=SILVER&occasion=FESTIVAL' },
    ],
    metalPurity: [
      { labelHi: '999 शुद्ध चाँदी', href: '/products?purity=SILVER_999' },
      { labelHi: '925 स्टर्लिंग',  href: '/products?purity=SILVER_925' },
      { labelHi: 'ऑक्सीडाइज़्ड चाँदी', href: '/products?metal=SILVER&search=oxidised' },
      { labelHi: 'जड़ाऊ चाँदी',    href: '/products?metal=SILVER&style=STATEMENT' },
      { labelHi: 'पोलिश चाँदी',    href: '/products?metal=SILVER&style=DAILY_WEAR' },
    ],
    priceBand: [
      { labelHi: '₹500 तक',    href: '/products?metal=SILVER&priceMax=50000' },
      { labelHi: '₹500–₹2000', href: '/products?metal=SILVER&priceMin=50000&priceMax=200000' },
      { labelHi: '₹2K–₹5K',    href: '/products?metal=SILVER&priceMin=200000&priceMax=500000' },
      { labelHi: '₹5K–₹10K',   href: '/products?metal=SILVER&priceMin=500000&priceMax=1000000' },
      { labelHi: '₹10K से ऊपर', href: '/products?metal=SILVER&priceMin=1000000' },
    ],
    occasion: [
      { labelHi: 'त्यौहार', labelEn: 'Festival', href: '/products?metal=SILVER&occasion=FESTIVAL' },
      { labelHi: 'उपहार',   labelEn: 'Gift',     href: '/products?metal=SILVER&occasion=GIFT' },
      { labelHi: 'शादी',    labelEn: 'Wedding',  href: '/products?metal=SILVER&occasion=WEDDING' },
      { labelHi: 'रोज़ाना', labelEn: 'Daily',    href: '/products?metal=SILVER&occasion=DAILY' },
      { labelHi: 'पार्टी',  labelEn: 'Party',   href: '/products?metal=SILVER&occasion=PARTY' },
    ],
  },
};

export interface CategoryTile {
  key:     string;
  labelHi: string;
  labelEn: string;
  href:    string;
}

export const STOREFRONT_CATEGORY_TILES: CategoryTile[] = [
  { key: 'rings',       labelHi: 'अंगूठी',   labelEn: 'Rings',     href: '/products?search=ring' },
  { key: 'earrings',    labelHi: 'झुमके',    labelEn: 'Earrings',  href: '/products?search=earring' },
  { key: 'pendants',    labelHi: 'पेंडेंट',  labelEn: 'Pendants',  href: '/products?search=pendant' },
  { key: 'bangles',     labelHi: 'चूड़ी',   labelEn: 'Bangles',   href: '/products?search=bangle' },
  { key: 'necklaces',   labelHi: 'हार',      labelEn: 'Necklaces', href: '/products?search=necklace' },
  { key: 'mangalsutra', labelHi: 'मंगलसूत्र', labelEn: 'Mangalsutra', href: '/products?search=mangalsutra' },
  { key: 'bracelets',   labelHi: 'कड़ा',     labelEn: 'Bracelets', href: '/products?search=bracelet' },
  { key: 'silver',      labelHi: 'चाँदी',   labelEn: 'Silver',    href: '/products?metal=SILVER' },
];

export interface OccasionTile {
  key:     string;
  labelHi: string;
  labelEn: string;
  href:    string;
}

export const STOREFRONT_OCCASION_TILES: OccasionTile[] = [
  { key: 'wedding',    labelHi: 'शादी',     labelEn: 'Wedding',    href: '/products?occasion=WEDDING' },
  { key: 'engagement', labelHi: 'सगाई',     labelEn: 'Engagement', href: '/products?occasion=ENGAGEMENT' },
  { key: 'festival',   labelHi: 'त्यौहार',  labelEn: 'Festival',   href: '/products?occasion=FESTIVAL' },
  { key: 'gift',       labelHi: 'उपहार',    labelEn: 'Gift',       href: '/products?occasion=GIFT' },
  { key: 'daily',      labelHi: 'रोज़ाना',  labelEn: 'Daily Wear', href: '/products?occasion=DAILY' },
];

export interface GiftPersonaTile {
  key:     string;
  labelHi: string;
  labelEn: string;
  href:    string;
}

export const STOREFRONT_GIFT_PERSONAS: GiftPersonaTile[] = [
  { key: 'mother', labelHi: 'माँ के लिए',     labelEn: 'For Mother', href: '/products?giftPersona=MOTHER' },
  { key: 'sister', labelHi: 'बहन के लिए',     labelEn: 'For Sister', href: '/products?giftPersona=SISTER' },
  { key: 'wife',   labelHi: 'पत्नी के लिए',   labelEn: 'For Wife',   href: '/products?giftPersona=WIFE' },
  { key: 'bride',  labelHi: 'दुल्हन के लिए',  labelEn: 'For Bride',  href: '/products?giftPersona=BRIDE' },
  { key: 'self',   labelHi: 'खुद के लिए',     labelEn: 'For Self',   href: '/products?giftPersona=SELF' },
  { key: 'friend', labelHi: 'दोस्त के लिए',   labelEn: 'For Friend', href: '/products?giftPersona=FRIEND' },
];
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @goldsmith/customer-shared typecheck
```

Expected: no errors (pure type/data file, no logic to go wrong).

- [ ] **Step 3: Commit**

```bash
cd C:\gs-stf-4
git add packages/customer-shared/src/storefront-nav.ts
git commit -m "feat(ws-b): storefront-nav — Hindi-first nav data, mega-menu, category/occasion/gift tiles"
```

---

## Task 5: WS-B — SVG fallbacks + categoryToFallbackSvg (TDD)

**Files:**
- Create: `packages/customer-shared/src/illustrations/ring.svg`
- Create: `packages/customer-shared/src/illustrations/earring.svg`
- Create: `packages/customer-shared/src/illustrations/pendant.svg`
- Create: `packages/customer-shared/src/illustrations/bangle.svg`
- Create: `packages/customer-shared/src/illustrations/necklace.svg`
- Create: `packages/customer-shared/src/illustrations/silver.svg`
- Create: `packages/customer-shared/src/illustrations/index.ts`
- Create: `packages/customer-shared/test/illustrations.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/customer-shared/test/illustrations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  categoryToFallbackSvg,
  RING_SVG, EARRING_SVG, PENDANT_SVG,
  BANGLE_SVG, NECKLACE_SVG, SILVER_SVG,
} from '../src/illustrations';

describe('SVG constants', () => {
  for (const [name, svg] of [
    ['RING_SVG', RING_SVG], ['EARRING_SVG', EARRING_SVG],
    ['PENDANT_SVG', PENDANT_SVG], ['BANGLE_SVG', BANGLE_SVG],
    ['NECKLACE_SVG', NECKLACE_SVG], ['SILVER_SVG', SILVER_SVG],
  ] as const) {
    it(`${name} is valid SVG with cream background`, () => {
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox="0 0 800 1000"');
      expect(svg).toContain('#F5EDDD');  // cream bg
      expect(svg).toContain('#B58A3C');  // aged-gold lines
      expect(svg).not.toContain('Goldsmith');
    });
  }
});

describe('categoryToFallbackSvg', () => {
  it('returns RING_SVG for "rings"', () => {
    expect(categoryToFallbackSvg('rings')).toBe(RING_SVG);
  });

  it('returns RING_SVG for "Ring" (case-insensitive)', () => {
    expect(categoryToFallbackSvg('Ring')).toBe(RING_SVG);
  });

  it('returns EARRING_SVG for "earrings"', () => {
    expect(categoryToFallbackSvg('earrings')).toBe(EARRING_SVG);
  });

  it('returns PENDANT_SVG for "pendants"', () => {
    expect(categoryToFallbackSvg('pendants')).toBe(PENDANT_SVG);
  });

  it('returns BANGLE_SVG for "bangles"', () => {
    expect(categoryToFallbackSvg('bangles')).toBe(BANGLE_SVG);
  });

  it('returns NECKLACE_SVG for "necklaces"', () => {
    expect(categoryToFallbackSvg('necklaces')).toBe(NECKLACE_SVG);
  });

  it('returns SILVER_SVG for "silver"', () => {
    expect(categoryToFallbackSvg('silver')).toBe(SILVER_SVG);
  });

  it('falls back to SILVER_SVG for unknown category', () => {
    expect(categoryToFallbackSvg('unknown-category')).toBe(SILVER_SVG);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @goldsmith/customer-shared test -- test/illustrations.test.ts
```

Expected: `Cannot find module '../src/illustrations'`

- [ ] **Step 3: Create 6 SVG files**

`packages/customer-shared/src/illustrations/ring.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><ellipse cx="400" cy="580" rx="175" ry="68" fill="none" stroke="#B58A3C" stroke-width="26"/><path d="M225 580 C225 375 575 375 575 580" fill="none" stroke="#B58A3C" stroke-width="26"/><polygon points="400,340 366,378 400,416 434,378" fill="none" stroke="#B58A3C" stroke-width="20" stroke-linejoin="round"/></svg>
```

`packages/customer-shared/src/illustrations/earring.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><circle cx="400" cy="240" r="32" fill="none" stroke="#B58A3C" stroke-width="22"/><path d="M400 272 C400 272 280 480 280 630 Q280 780 400 820 Q520 780 520 630 C520 480 400 272 400 272Z" fill="none" stroke="#B58A3C" stroke-width="22"/></svg>
```

`packages/customer-shared/src/illustrations/pendant.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><path d="M320 160 Q400 140 480 160" fill="none" stroke="#B58A3C" stroke-width="20"/><line x1="400" y1="140" x2="400" y2="310" stroke="#B58A3C" stroke-width="18"/><polygon points="400,310 306,540 400,770 494,540" fill="none" stroke="#B58A3C" stroke-width="22" stroke-linejoin="round"/></svg>
```

`packages/customer-shared/src/illustrations/bangle.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><circle cx="400" cy="500" r="220" fill="none" stroke="#B58A3C" stroke-width="36"/></svg>
```

`packages/customer-shared/src/illustrations/necklace.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><path d="M160 180 Q180 500 400 640 Q620 500 640 180" fill="none" stroke="#B58A3C" stroke-width="22"/><polygon points="400,640 366,682 400,724 434,682" fill="none" stroke="#B58A3C" stroke-width="20" stroke-linejoin="round"/></svg>
```

`packages/customer-shared/src/illustrations/silver.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><rect x="220" y="380" width="360" height="240" rx="28" fill="none" stroke="#B58A3C" stroke-width="24"/><line x1="220" y1="452" x2="580" y2="452" stroke="#B58A3C" stroke-width="16"/><line x1="220" y1="548" x2="580" y2="548" stroke="#B58A3C" stroke-width="16"/></svg>
```

- [ ] **Step 4: Create illustrations/index.ts**

Read each SVG file's content and inline it as a string (so the package has zero file-system deps at runtime — mobile needs string SVG, not file paths).

`packages/customer-shared/src/illustrations/index.ts`:

```ts
// Inline SVG strings — viewBox 800×1000 (4:5 portrait), cream #F5EDDD bg,
// aged-gold #B58A3C line work. Zero file-system dependency at runtime:
// mobile consumes raw SVG markup; web imports .svg files via bundler (?react).

export const RING_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><ellipse cx="400" cy="580" rx="175" ry="68" fill="none" stroke="#B58A3C" stroke-width="26"/><path d="M225 580 C225 375 575 375 575 580" fill="none" stroke="#B58A3C" stroke-width="26"/><polygon points="400,340 366,378 400,416 434,378" fill="none" stroke="#B58A3C" stroke-width="20" stroke-linejoin="round"/></svg>';

export const EARRING_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><circle cx="400" cy="240" r="32" fill="none" stroke="#B58A3C" stroke-width="22"/><path d="M400 272 C400 272 280 480 280 630 Q280 780 400 820 Q520 780 520 630 C520 480 400 272 400 272Z" fill="none" stroke="#B58A3C" stroke-width="22"/></svg>';

export const PENDANT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><path d="M320 160 Q400 140 480 160" fill="none" stroke="#B58A3C" stroke-width="20"/><line x1="400" y1="140" x2="400" y2="310" stroke="#B58A3C" stroke-width="18"/><polygon points="400,310 306,540 400,770 494,540" fill="none" stroke="#B58A3C" stroke-width="22" stroke-linejoin="round"/></svg>';

export const BANGLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><circle cx="400" cy="500" r="220" fill="none" stroke="#B58A3C" stroke-width="36"/></svg>';

export const NECKLACE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><path d="M160 180 Q180 500 400 640 Q620 500 640 180" fill="none" stroke="#B58A3C" stroke-width="22"/><polygon points="400,640 366,682 400,724 434,682" fill="none" stroke="#B58A3C" stroke-width="20" stroke-linejoin="round"/></svg>';

export const SILVER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><rect x="220" y="380" width="360" height="240" rx="28" fill="none" stroke="#B58A3C" stroke-width="24"/><line x1="220" y1="452" x2="580" y2="452" stroke="#B58A3C" stroke-width="16"/><line x1="220" y1="548" x2="580" y2="548" stroke="#B58A3C" stroke-width="16"/></svg>';

const CATEGORY_MAP: Array<[pattern: string, svg: string]> = [
  ['ring',     RING_SVG],
  ['earring',  EARRING_SVG],
  ['jhumk',    EARRING_SVG],  // jhumka / jhumke
  ['pendant',  PENDANT_SVG],
  ['bangle',   BANGLE_SVG],
  ['chudi',    BANGLE_SVG],
  ['necklace', NECKLACE_SVG],
  ['haar',     NECKLACE_SVG],
  ['silver',   SILVER_SVG],
  ['chandi',   SILVER_SVG],
];

export function categoryToFallbackSvg(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  for (const [pattern, svg] of CATEGORY_MAP) {
    if (lower.includes(pattern)) return svg;
  }
  return SILVER_SVG;
}
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
pnpm --filter @goldsmith/customer-shared test
```

Expected: 22 tests pass (6 format + 8 catalog-filters + 6 SVG constants + 8 illustration routing = wait — the SVG constant test is a loop over 6 SVGs × 4 assertions = 24 individual assertions but Vitest counts it as 6 `it` blocks; plus 8 categoryToFallbackSvg tests = 14 illustration tests total). Check that all pass.

- [ ] **Step 6: Typecheck the package**

```bash
pnpm --filter @goldsmith/customer-shared typecheck
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd C:\gs-stf-4
git add packages/customer-shared/src/illustrations/ packages/customer-shared/test/illustrations.test.ts
git commit -m "feat(ws-b): 6 SVG fallbacks + categoryToFallbackSvg — inline strings, 800×1000 portrait, cream/aged-gold palette"
```

---

## Task 6: WS-C — Migrate types in customer-web

**Files:**
- Modify: `apps/customer-web/package.json`
- Modify: `apps/customer-web/lib/api.ts`
- Modify: `apps/customer-web/lib/theme.ts`

- [ ] **Step 1: Add dependency to customer-web**

In `apps/customer-web/package.json`, add to `"dependencies"`:

```json
"@goldsmith/customer-shared": "workspace:*"
```

Then run install:

```bash
cd C:\gs-stf-4
pnpm install
```

- [ ] **Step 2: Update apps/customer-web/lib/api.ts — replace inline type definitions with imports**

The file currently defines types inline and uses them in fetch functions. Replace the inline type block (lines 4–59) with imports from `@goldsmith/customer-shared`. The fetch functions stay in `api.ts` (they are web-specific, not shared).

Replace the top of `apps/customer-web/lib/api.ts`:

```ts
// Typed fetch helpers for public catalog API.
// Type definitions have moved to @goldsmith/customer-shared.
// Only web-specific fetch implementations remain here.

export type {
  TenantConfigResponse,
  EstimatedPrice,
  CatalogProduct,
  CatalogProductsResponse,
  PublicRateEntry,
  PublicRatesResponse,
  ReviewItem,
  ReviewsResponse,
  PublicImageItem,
} from '@goldsmith/customer-shared';

import type {
  TenantConfigResponse,
  CatalogProduct,
  CatalogProductsResponse,
  PublicRatesResponse,
  ReviewsResponse,
  PublicImageItem,
} from '@goldsmith/customer-shared';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';
```

Then keep all the `fetchTenantConfig`, `fetchPublicRates`, `fetchProducts`, `fetchProduct`, `fetchProductReviews`, `fetchProductImages`, `fetchReturnPolicy` functions unchanged. Only remove the inline interface definitions that are now imported.

- [ ] **Step 3: Update apps/customer-web/lib/theme.ts — remove METAL_LABELS, PURITY_LABELS, metalLabel, purityLabel**

Replace the entire `apps/customer-web/lib/theme.ts` content with:

```ts
import type React from 'react';
export { METAL_LABELS, PURITY_LABELS, metalLabel, purityLabel } from '@goldsmith/customer-shared';

export function buildThemeStyle(primaryColor: string): React.CSSProperties {
  return {
    ['--primary-color' as string]: primaryColor,
  } as React.CSSProperties;
}
```

- [ ] **Step 4: Typecheck customer-web**

```bash
pnpm --filter @goldsmith/customer-web typecheck
```

Expected: exit 0 (same types as before, just imported from shared package).

If errors appear like "Module not found", verify `@goldsmith/customer-shared` is in `package.json` and `pnpm install` was run. If TS complains about `export type` re-exports, adjust to use `export { type ... }` syntax.

- [ ] **Step 5: Commit**

```bash
cd C:\gs-stf-4
git add apps/customer-web/package.json apps/customer-web/lib/api.ts apps/customer-web/lib/theme.ts
git commit -m "feat(ws-c): customer-web imports types from @goldsmith/customer-shared — dedup METAL_LABELS, catalog interfaces"
```

---

## Task 7: WS-C — Migrate types in customer-mobile

**Files:**
- Modify: `apps/customer-mobile/package.json`
- Modify: `apps/customer-mobile/src/api/endpoints.ts`

- [ ] **Step 1: Add dependency to customer-mobile**

In `apps/customer-mobile/package.json`, add to `"dependencies"`:

```json
"@goldsmith/customer-shared": "workspace:*"
```

```bash
cd C:\gs-stf-4
pnpm install
```

- [ ] **Step 2: Update apps/customer-mobile/src/api/endpoints.ts — remove inline type duplicates**

Read the current file first. Then replace inline type definitions that duplicate the shared package with imports. The types to remove from this file (they already exist in `@goldsmith/customer-shared`):
- `PublicRateEntry`, `PublicRatesResponse`
- `CatalogEstimatedPrice` → now `EstimatedPrice` in shared (they have the same shape)
- `CatalogProduct`, `CatalogProductsResponse`
- `HuidVerifyResult`

Replace the top of `apps/customer-mobile/src/api/endpoints.ts`:

```ts
import axios from 'axios';
import { api } from './client';
import type { Tenant, TenantBranding } from '../stores/tenantStore';
import type {
  PublicRateEntry,
  PublicRatesResponse,
  EstimatedPrice,
  CatalogProduct,
  CatalogProductsResponse,
  HuidVerifyResult,
} from '@goldsmith/customer-shared';

// CatalogEstimatedPrice was renamed to EstimatedPrice in @goldsmith/customer-shared.
// Re-export as alias for any mobile code that references the old name.
export type { EstimatedPrice as CatalogEstimatedPrice } from '@goldsmith/customer-shared';
export type {
  PublicRateEntry,
  PublicRatesResponse,
  CatalogProduct,
  CatalogProductsResponse,
  HuidVerifyResult,
} from '@goldsmith/customer-shared';
```

Remove the now-redundant inline interface definitions from the file body (TenantBootApiResponse stays since it's internal).

- [ ] **Step 3: Typecheck customer-mobile**

```bash
pnpm --filter @goldsmith/customer-mobile typecheck
```

Expected: exit 0. If errors appear referencing `CatalogEstimatedPrice`, verify the alias re-export is in place.

- [ ] **Step 4: Commit**

```bash
cd C:\gs-stf-4
git add apps/customer-mobile/package.json apps/customer-mobile/src/api/endpoints.ts
git commit -m "feat(ws-c): customer-mobile imports types from @goldsmith/customer-shared — dedup PublicRates, CatalogProduct"
```

---

## Task 8: Final verification — typecheck, tests, code-truth grep

- [ ] **Step 1: Full package test run**

```bash
pnpm --filter @goldsmith/customer-shared test
```

Expected: all tests pass (format + catalog-filters + illustrations suites).

- [ ] **Step 2: Monorepo typecheck**

```bash
pnpm --filter @goldsmith/customer-web typecheck
pnpm --filter @goldsmith/customer-mobile typecheck
pnpm --filter @goldsmith/customer-shared typecheck
```

All three should exit 0.

- [ ] **Step 3: Code-truth greps**

```bash
# Confirm the shared package is referenced in both apps
git grep "@goldsmith/customer-shared" -- "*/package.json"
# Expected: apps/customer-web/package.json AND apps/customer-mobile/package.json

# Confirm no "Goldsmith" brand string in the new package
git grep -r "Goldsmith" -- "packages/customer-shared/src/"
# Expected: no output

# Confirm METAL_LABELS moved out of theme.ts
git grep "METAL_LABELS" -- "apps/customer-web/lib/theme.ts"
# Expected: only the re-export line (export { METAL_LABELS ... }), no definition

# Confirm inline EstimatedPrice removed from customer-web api.ts
git grep "interface EstimatedPrice" -- "apps/customer-web/lib/api.ts"
# Expected: no output

# Confirm SVG files exist
ls packages/customer-shared/src/illustrations/*.svg
# Expected: 6 SVG files listed
```

- [ ] **Step 4: Build smoke (via turbo)**

```bash
pnpm build 2>&1 | tail -5
```

Expected: turbo reports tasks successful (all from cache or new). No new build errors.

- [ ] **Step 5: Commit any fixes**

If steps 1–4 require changes, fix and commit:

```bash
git add <fixed files>
git commit -m "fix(a4): typecheck/lint corrections"
```

If no fixes needed, skip.

---

## Resume Point

If interrupted, check progress with:

```bash
git log --oneline main..HEAD
pnpm --filter @goldsmith/customer-shared test
pnpm --filter @goldsmith/customer-web typecheck
pnpm --filter @goldsmith/customer-mobile typecheck
git grep "@goldsmith/customer-shared" -- "*/package.json"
```

---

## What is NOT in this story

- No Zod schema for `StorefrontConfig` — lives in `@goldsmith/shared` (A5, already shipped)
- No React/RN wrappers for SVGs — consumers do that in their own packages
- No API client functions — `api.ts` fetch functions stay in customer-web (web-specific ISR caching)
- No `build` script — source-first package, like `@goldsmith/ui-tokens`
- No `storefront.ts` migration (file doesn't exist in this codebase — helpers written fresh)
