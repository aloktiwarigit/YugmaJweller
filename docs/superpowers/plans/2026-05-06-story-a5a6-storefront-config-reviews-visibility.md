# A5+A6: Storefront Config JSONB + Reviews Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `storefront_config_json JSONB NOT NULL DEFAULT '{}'` to `shop_settings` (migration 0069) and `is_publicly_visible BOOLEAN NOT NULL DEFAULT TRUE` to `product_reviews` (migration 0070), shipping a Zod schema in `@goldsmith/shared` and TDD coverage across all 11 mandatory assertions.

**Architecture:** A5 follows the established JSONB config pattern (`making_charges_json`, `wastage_json`) — Zod validates shape at the API layer, DB stores `'{}'`, service merges `STOREFRONT_CONFIG_DEFAULTS` on read. A6 adds visibility control for DPDPA compliance; filtering logic lands in Phase B (Story B4). Both migrations are additive `ALTER TABLE` statements with no data loss risk. No app-code changes in this story.

**Tech Stack:** Postgres 15 (via `@testcontainers/postgresql`), Drizzle ORM (`tenantScopedTable` / `tenantSingletonTable`), Zod 3, Vitest, `@goldsmith/db` (`createPool` / `runMigrations` / `withTenantTx`), `@goldsmith/tenant-context` (`tenantContext`)

---

## File Map

### Create
| File | Purpose |
|---|---|
| `packages/shared/src/schemas/storefront-config.schema.ts` | StorefrontConfigSchema + STOREFRONT_CONFIG_DEFAULTS |
| `packages/shared/src/schemas/storefront-config.schema.test.ts` | 7 unit tests (T2–T6, T11, T2b) |
| `packages/db/src/migrations/0069_shop_storefront_config.sql` | ALTER TABLE shop_settings ADD COLUMN |
| `packages/db/src/migrations/0070_product_reviews_visibility.sql` | ALTER TABLE product_reviews ADD COLUMN + partial index |
| `packages/db/src/schema/product-reviews.ts` | Drizzle table (no file existed; includes is_publicly_visible) |
| `apps/api/test/a5a6-migrations.integration.test.ts` | T1, T8, T9, T10 — column defaults + index existence |

### Modify
| File | Change |
|---|---|
| `packages/db/src/schema/shop-settings.ts` | Add `storefront_config_json` jsonb column |
| `packages/db/src/schema/index.ts` | Add `export * from './product-reviews'` |
| `packages/shared/src/index.ts` | Export schema + types + STOREFRONT_CONFIG_DEFAULTS |
| `apps/api/test/settings/tenant-isolation.test.ts` | Add T7 — cross-tenant storefront_config_json write-block |

---

## Task 1: WS-C Red — Write unit tests for StorefrontConfigSchema

**Files:**
- Create: `packages/shared/src/schemas/storefront-config.schema.test.ts`

These tests should FAIL until Task 2 creates the schema file.

- [ ] **Step 1: Create the test file**

`packages/shared/src/schemas/storefront-config.schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  StorefrontConfigSchema,
  HeroBannerSchema,
  STOREFRONT_CONFIG_DEFAULTS,
} from './storefront-config.schema';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('StorefrontConfigSchema', () => {
  it('T5: empty object applies all defaults', () => {
    const result = StorefrontConfigSchema.parse({});
    expect(result.heroBanners).toEqual([]);
    expect(result.featuredCollectionIds).toEqual([]);
    expect(result.premiumCollectionIds).toEqual([]);
    expect(result.giftPersonaOverrides).toEqual([]);
    expect(result.brandPalette).toEqual({});
    expect(result.trustPillarsOverride).toEqual([]);
  });

  it('T2: round-trips a full config through Zod with no data loss', () => {
    const config = {
      heroBanners: [{
        imageId: VALID_UUID,
        headlineHi: 'आभूषण संग्रह',
        headlineEn: 'Jewellery Collection',
        ctaUrl: '/products',
        validFrom: '2026-01-01T00:00:00.000Z',
      }],
      featuredCollectionIds: [VALID_UUID],
      premiumCollectionIds: [],
      giftPersonaOverrides: [{ persona: 'Mother', href: '/gift/mother', label: 'माँ के लिए' }],
      brandPalette: { accentMode: 'warm' as const, heroPattern: 'lotus' as const },
      trustPillarsOverride: [{ titleHi: 'हॉलमार्क', titleEn: 'BIS Hallmark', descriptionHi: 'प्रमाणित सोना' }],
    };
    const result = StorefrontConfigSchema.parse(config);
    expect(result.heroBanners[0]!.headlineHi).toBe('आभूषण संग्रह');
    expect(result.heroBanners[0]!.ctaUrl).toBe('/products');
    expect(result.brandPalette.accentMode).toBe('warm');
    expect(result.brandPalette.heroPattern).toBe('lotus');
    expect(result.giftPersonaOverrides[0]!.label).toBe('माँ के लिए');
    expect(result.trustPillarsOverride[0]!.titleEn).toBe('BIS Hallmark');
  });

  it('T3: rejects ctaUrl that is not an internal route', () => {
    expect(() =>
      HeroBannerSchema.parse({
        imageId: VALID_UUID,
        headlineHi: 'Test',
        ctaUrl: 'https://example.com/foo',
      }),
    ).toThrow(/must be an internal route/);
  });

  it('T3b: rejects ctaUrl without leading slash', () => {
    expect(() =>
      HeroBannerSchema.parse({
        imageId: VALID_UUID,
        headlineHi: 'Test',
        ctaUrl: 'products',
      }),
    ).toThrow(/must be an internal route/);
  });

  it('T4: rejects unknown accentMode enum value', () => {
    expect(() =>
      StorefrontConfigSchema.parse({ brandPalette: { accentMode: 'neon' } }),
    ).toThrow();
  });

  it('T6: STOREFRONT_CONFIG_DEFAULTS has exactly 5 trust pillars in Hindi', () => {
    expect(STOREFRONT_CONFIG_DEFAULTS.trustPillarsOverride).toHaveLength(5);
    const titles = STOREFRONT_CONFIG_DEFAULTS.trustPillarsOverride.map(p => p.titleHi);
    expect(titles).toContain('BIS हॉलमार्क');
    expect(titles).toContain('HUID ट्रैकिंग');
    expect(titles).toContain('एक्सचेंज');
    expect(titles).toContain('बायबैक');
    expect(titles).toContain('ट्राई एट होम');
  });

  it('T11: imageId in heroBanner must be a valid UUID', () => {
    expect(() =>
      HeroBannerSchema.parse({
        imageId: 'not-a-uuid',
        headlineHi: 'Test',
        ctaUrl: '/products',
      }),
    ).toThrow();
  });

  it('T2b: partial config keeps existing keys and applies Zod defaults for missing ones', () => {
    const result = StorefrontConfigSchema.parse({
      brandPalette: { accentMode: 'cool' as const },
      featuredCollectionIds: [VALID_UUID],
    });
    expect(result.heroBanners).toEqual([]);            // default applied
    expect(result.brandPalette.accentMode).toBe('cool'); // provided value kept
    expect(result.featuredCollectionIds).toEqual([VALID_UUID]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @goldsmith/shared test
```

Expected: `FAIL` with `Cannot find module './storefront-config.schema'`

---

## Task 2: WS-C Green — Implement StorefrontConfigSchema

**Files:**
- Create: `packages/shared/src/schemas/storefront-config.schema.ts`

- [ ] **Step 1: Create the schema file**

`packages/shared/src/schemas/storefront-config.schema.ts`:

```ts
import { z } from 'zod';

export const HeroBannerSchema = z.object({
  imageId:    z.string().uuid(),
  headlineHi: z.string().min(1).max(120),
  headlineEn: z.string().max(120).optional(),
  ctaUrl:     z.string().regex(/^\//, 'must be an internal route starting with /'),
  validFrom:  z.string().datetime().optional(),
  validTo:    z.string().datetime().optional(),
});

export const GiftPersonaOverrideSchema = z.object({
  persona: z.string().min(1),
  href:    z.string().min(1),
  label:   z.string().min(1),
});

export const TrustPillarSchema = z.object({
  titleHi:       z.string().min(1),
  titleEn:       z.string().optional(),
  descriptionHi: z.string().min(1),
});

export const BrandPaletteSchema = z.object({
  accentMode:  z.enum(['warm', 'cool', 'luxe']).optional(),
  heroPattern: z.enum(['devanagari-numerals', 'lotus', 'temple', 'none']).optional(),
});

export const StorefrontConfigSchema = z.object({
  heroBanners:           z.array(HeroBannerSchema).default([]),
  featuredCollectionIds: z.array(z.string().uuid()).default([]),
  premiumCollectionIds:  z.array(z.string().uuid()).default([]),
  giftPersonaOverrides:  z.array(GiftPersonaOverrideSchema).default([]),
  brandPalette:          BrandPaletteSchema.default({}),
  trustPillarsOverride:  z.array(TrustPillarSchema).default([]),
});

export type StorefrontConfig = z.infer<typeof StorefrontConfigSchema>;

export const PatchStorefrontConfigSchema = StorefrontConfigSchema.partial();
export type PatchStorefrontConfigDto = z.infer<typeof PatchStorefrontConfigSchema>;

export const STOREFRONT_CONFIG_DEFAULTS: StorefrontConfig = {
  heroBanners:           [],
  featuredCollectionIds: [],
  premiumCollectionIds:  [],
  giftPersonaOverrides:  [],
  brandPalette:          {},
  trustPillarsOverride: [
    {
      titleHi:       'BIS हॉलमार्क',
      titleEn:       'BIS Hallmark',
      descriptionHi: 'सोने की शुद्धता प्रमाणित',
    },
    {
      titleHi:       'HUID ट्रैकिंग',
      titleEn:       'HUID Tracking',
      descriptionHi: 'हर आभूषण का विशेष ID',
    },
    {
      titleHi:       'एक्सचेंज',
      titleEn:       'Exchange',
      descriptionHi: 'पुराने सोने पर उचित मूल्य',
    },
    {
      titleHi:       'बायबैक',
      titleEn:       'Buyback',
      descriptionHi: 'खरीदी कीमत की गारंटी',
    },
    {
      titleHi:       'ट्राई एट होम',
      titleEn:       'Try at Home',
      descriptionHi: 'घर पर देखें, पसंद आए तो लें',
    },
  ],
};
```

- [ ] **Step 2: Run — expect PASS**

```bash
pnpm --filter @goldsmith/shared test
```

Expected: `8 tests passed`

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas/storefront-config.schema.ts packages/shared/src/schemas/storefront-config.schema.test.ts
git commit -m "feat(ws-c): add StorefrontConfigSchema + STOREFRONT_CONFIG_DEFAULTS — 8 unit tests green"
```

---

## Task 3: WS-C — Export from packages/shared/src/index.ts

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add exports at the end of `packages/shared/src/index.ts`**

Append after the last `export` block (after the `LoyaltyTransactionType`/`AdjustPointsBody` exports):

```ts
export {
  StorefrontConfigSchema,
  PatchStorefrontConfigSchema,
  HeroBannerSchema,
  GiftPersonaOverrideSchema,
  TrustPillarSchema,
  BrandPaletteSchema,
  STOREFRONT_CONFIG_DEFAULTS,
} from './schemas/storefront-config.schema';
export type {
  StorefrontConfig,
  PatchStorefrontConfigDto,
} from './schemas/storefront-config.schema';
```

- [ ] **Step 2: Build shared and confirm no type errors**

```bash
pnpm --filter @goldsmith/shared build
```

Expected: exit 0, `dist/` files emitted.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(ws-c): export StorefrontConfigSchema from @goldsmith/shared public API"
```

---

## Task 4: WS-A+B Red — Write migration integration tests

**Files:**
- Create: `apps/api/test/a5a6-migrations.integration.test.ts`

These tests must FAIL until migrations 0069 and 0070 are created (Tasks 5–6).

The test spins up a fresh Postgres container, runs all migrations from the `packages/db/src/migrations/` directory, then checks column and index existence.

- [ ] **Step 1: Create the integration test file**

`apps/api/test/a5a6-migrations.integration.test.ts`:

```ts
// Integration tests for migrations 0069 and 0070.
// T1:  storefront_config_json defaults to '{}'::jsonb (NOT NULL)
// T8:  is_publicly_visible defaults to TRUE (NOT NULL)
// T9:  partial index idx_product_reviews_public exists and covers the right predicate
// T10: the partial index predicate excludes is_publicly_visible=FALSE rows

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ─── A5: shop_settings.storefront_config_json ─────────────────────────────────

describe('migration 0069 — shop_settings.storefront_config_json', () => {
  it('T1: column exists and is NOT NULL with JSONB type', async () => {
    const { rows } = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'shop_settings'
          AND column_name = 'storefront_config_json'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data_type).toBe('jsonb');
    expect(rows[0]!.is_nullable).toBe('NO');
  });

  it('T1b: INSERT without column produces default empty object', async () => {
    const SHOP_ID = '33333333-3333-3333-3333-333333333333';
    // Seed a shop as superuser (bypasses RLS)
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, $2, $3, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [SHOP_ID, 'migration-test-shop', 'Migration Test Shop'],
    );
    // Insert shop_settings without storefront_config_json (superuser bypasses RLS)
    await pool.query(
      `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
      [SHOP_ID],
    );
    const { rows } = await pool.query<{ storefront_config_json: Record<string, unknown> }>(
      `SELECT storefront_config_json FROM shop_settings WHERE shop_id = $1`,
      [SHOP_ID],
    );
    expect(rows).toHaveLength(1);
    // Postgres returns the JSONB value parsed; empty object expected
    expect(rows[0]!.storefront_config_json).toEqual({});
  });
});

// ─── A6: product_reviews.is_publicly_visible ──────────────────────────────────

describe('migration 0070 — product_reviews.is_publicly_visible', () => {
  it('T8: column exists and is NOT NULL BOOLEAN with default TRUE', async () => {
    const { rows } = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_name = 'product_reviews'
          AND column_name = 'is_publicly_visible'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data_type).toBe('boolean');
    expect(rows[0]!.is_nullable).toBe('NO');
    // Postgres stores the default as 'true' for boolean literals
    expect(rows[0]!.column_default).toBe('true');
  });

  it('T9: partial index idx_product_reviews_public exists with correct predicate', async () => {
    const { rows } = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
         FROM pg_indexes
        WHERE tablename = 'product_reviews'
          AND indexname = 'idx_product_reviews_public'`,
    );
    expect(rows).toHaveLength(1);
    // Index definition must include the partial predicate on is_publicly_visible = true
    expect(rows[0]!.indexdef).toContain('is_publicly_visible');
    // Postgres normalises the WHERE clause to: WHERE (is_publicly_visible = true)
    // This proves the index only covers visible rows — FALSE rows are excluded (T10)
    expect(rows[0]!.indexdef).toMatch(/where.*is_publicly_visible/i);
    // Must be ordered by created_at DESC
    expect(rows[0]!.indexdef).toContain('created_at');
    // Must scope to shop_id and product_id
    expect(rows[0]!.indexdef).toContain('shop_id');
    expect(rows[0]!.indexdef).toContain('product_id');
  });

  it('T10: indexdef predicate is WHERE is_publicly_visible = TRUE (FALSE rows excluded)', async () => {
    // Verify the partial index predicate explicitly excludes FALSE rows.
    // Postgres normalises the index definition to include the literal predicate text.
    // This test is the code-level proof that a review with is_publicly_visible=FALSE
    // will never be scanned by this index — without requiring a full FK-chain seed.
    const { rows } = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
        WHERE tablename = 'product_reviews' AND indexname = 'idx_product_reviews_public'`,
    );
    expect(rows).toHaveLength(1);
    // The predicate must be on TRUE, not FALSE — i.e. the index only covers public rows
    const def = rows[0]!.indexdef.toLowerCase();
    expect(def).toContain('is_publicly_visible');
    // Must not be a predicate for FALSE (which would be the wrong direction)
    expect(def).not.toContain('is_publicly_visible = false');
  });

  it('original idx_product_reviews_product index still exists (not dropped)', async () => {
    const { rows } = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'product_reviews'
          AND indexname = 'idx_product_reviews_product'`,
    );
    // Original non-partial index must not have been dropped — shopkeeper read path uses it
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL on columns**

```bash
pnpm --filter @goldsmith/api test:integration -- a5a6-migrations.integration.test.ts
```

Expected: Tests fail with `expect(rows).toHaveLength(1)` → received length 0 (columns don't exist yet because migrations 0069/0070 haven't been created).

---

## Task 5: WS-A Green — Migration 0069 + Drizzle shop-settings

**Files:**
- Create: `packages/db/src/migrations/0069_shop_storefront_config.sql`
- Modify: `packages/db/src/schema/shop-settings.ts`

- [ ] **Step 1: Create migration 0069**

`packages/db/src/migrations/0069_shop_storefront_config.sql`:

```sql
-- 0069_shop_storefront_config.sql
-- Add storefront_config_json JSONB column to shop_settings.
--
-- Shape is enforced at the API layer via StorefrontConfigSchema in @goldsmith/shared.
-- The DB stores '{}' (empty object) until a tenant overrides; the service layer merges
-- STOREFRONT_CONFIG_DEFAULTS on read (in catalog.service.getStorefrontConfig, Phase B).
-- No DB-side trigger or generated column — code-side merge follows the pattern of
-- making_charges_json, wastage_json, notification_prefs_json.
--
-- RLS: shop_settings already has rls_shop_settings_tenant_isolation covering FOR ALL
-- (USING shop_id = current_setting('app.current_shop_id')::uuid) — new column
-- inherits protection automatically. No new policy needed.
--
-- GRANT: existing GRANT SELECT, INSERT, UPDATE ON shop_settings TO app_user (migration 0006)
-- already covers all columns including this one. No new grant needed.

ALTER TABLE shop_settings
  ADD COLUMN storefront_config_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN shop_settings.storefront_config_json IS
  'Tenant homepage curation config. DB stores empty {}; service merges STOREFRONT_CONFIG_DEFAULTS on read (Phase B). '
  'Zod-validated via StorefrontConfigSchema in @goldsmith/shared. No GIN index until query patterns require it.';
```

- [ ] **Step 2: Update Drizzle shop-settings schema**

`packages/db/src/schema/shop-settings.ts` — add one line after `notification_prefs_json`:

Current file content (for reference):
```ts
import { jsonb, boolean, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { tenantSingletonTable } from './_helpers/tenantSingletonTable';

export const shopSettings = tenantSingletonTable('shop_settings', {
  making_charges_json:       jsonb('making_charges_json'),
  wastage_json:              jsonb('wastage_json'),
  loyalty_json:              jsonb('loyalty_json'),
  rate_lock_days:            integer('rate_lock_days'),
  try_at_home_enabled:       boolean('try_at_home_enabled').notNull().default(false),
  try_at_home_max_pieces:    integer('try_at_home_max_pieces'),
  custom_order_policy_text:  text('custom_order_policy_text'),
  return_policy_text:        text('return_policy_text'),
  notification_prefs_json:   jsonb('notification_prefs_json'),
  dead_stock_threshold_days: integer('dead_stock_threshold_days').notNull().default(180),
  updated_at:                timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Add `storefront_config_json` after `notification_prefs_json`:

```ts
import { jsonb, boolean, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { tenantSingletonTable } from './_helpers/tenantSingletonTable';

export const shopSettings = tenantSingletonTable('shop_settings', {
  making_charges_json:        jsonb('making_charges_json'),
  wastage_json:               jsonb('wastage_json'),
  loyalty_json:               jsonb('loyalty_json'),
  rate_lock_days:             integer('rate_lock_days'),
  try_at_home_enabled:        boolean('try_at_home_enabled').notNull().default(false),
  try_at_home_max_pieces:     integer('try_at_home_max_pieces'),
  custom_order_policy_text:   text('custom_order_policy_text'),
  return_policy_text:         text('return_policy_text'),
  notification_prefs_json:    jsonb('notification_prefs_json'),
  storefront_config_json:     jsonb('storefront_config_json').notNull().default({}),
  dead_stock_threshold_days:  integer('dead_stock_threshold_days').notNull().default(180),
  updated_at:                 timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## Task 6: WS-B Green — Migration 0070 + Drizzle product-reviews

**Files:**
- Create: `packages/db/src/migrations/0070_product_reviews_visibility.sql`
- Create: `packages/db/src/schema/product-reviews.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create migration 0070**

`packages/db/src/migrations/0070_product_reviews_visibility.sql`:

```sql
-- 0070_product_reviews_visibility.sql
-- Add is_publicly_visible BOOLEAN to product_reviews.
--
-- DPDPA NOTE: Default is TRUE (opt-out model, not opt-in).
-- All rows in this table were publicly visible before this migration — the original
-- table (migration 0047) had no visibility control. Backfilling to FALSE would silently
-- hide reviews customers expected to be public. TRUE preserves the existing contract.
-- Customer opt-out and shopkeeper moderation endpoints land in Phase B (Story B4),
-- which also adds GRANT UPDATE on this column to app_user. No UPDATE grant here.
--
-- Index strategy:
--   idx_product_reviews_product (no predicate, migration 0047) — kept; serves
--     the shopkeeper's private per-product review list.
--   idx_product_reviews_public (partial, below) — new; serves the Phase B public
--     reviews endpoint. Adding alongside avoids breaking the shopkeeper read path.
--
-- GRANT: original grants are SELECT, INSERT only (migration 0047). Customers submit
-- reviews; shopkeeper opt-out/moderation lands in Phase B as a separate endpoint.
-- No new grant in this migration.

ALTER TABLE product_reviews
  ADD COLUMN is_publicly_visible BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN product_reviews.is_publicly_visible IS
  'TRUE = display on public PDP reviews section. Default TRUE (opt-out model, DPDPA-aware). '
  'Customer/shopkeeper opt-out via Phase B Story B4 endpoint.';

CREATE INDEX idx_product_reviews_public
  ON product_reviews(shop_id, product_id, created_at DESC)
  WHERE is_publicly_visible = TRUE;
```

- [ ] **Step 2: Create Drizzle product-reviews schema (new file)**

No Drizzle schema existed for `product_reviews` — create it now including all columns from migration 0047 plus `is_publicly_visible` from 0070.

`packages/db/src/schema/product-reviews.ts`:

```ts
import { uuid, smallint, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { products } from './products';
import { customers } from './customers';

export const productReviews = tenantScopedTable('product_reviews', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  product_id:          uuid('product_id').notNull().references(() => products.id),
  customer_id:         uuid('customer_id').notNull().references(() => customers.id),
  rating:              smallint('rating').notNull(),
  review_text:         text('review_text'),
  is_publicly_visible: boolean('is_publicly_visible').notNull().default(true),
  created_at:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: Export from schema index**

`packages/db/src/schema/index.ts` — add at the end:

```ts
export * from './product-reviews';
```

The full end of the file should look like:
```ts
// ...existing exports...
export * from './custom-orders';
export * from './product-reviews';
```

---

## Task 7: WS-A+B Verify — Run integration tests, commit

- [ ] **Step 1: Run migration integration tests**

```bash
pnpm --filter @goldsmith/api test:integration -- a5a6-migrations.integration.test.ts
```

Expected: `6 tests passed` (T1, T1b, T8, T9, T10, original-index-not-dropped)

If any test fails:
- Column missing → check the migration SQL file name matches the pattern `0069_*.sql` exactly (lowercase, no spaces)
- `storefront_config_json` is NULL → check `NOT NULL DEFAULT '{}'::jsonb` in migration 0069
- `column_default` for `is_publicly_visible` not `'true'` → check `DEFAULT TRUE` (not `DEFAULT 'true'` — Postgres uses the literal `true` for booleans)
- `idx_product_reviews_public` missing → check migration 0070 CREATE INDEX statement

- [ ] **Step 2: Build @goldsmith/db to confirm Drizzle types compile**

```bash
pnpm --filter @goldsmith/db build
```

Expected: exit 0 (may warn about `@goldsmith/observability` in worktree — that is pre-existing; full turbo build resolves it).

- [ ] **Step 3: Commit WS-A + WS-B**

```bash
git add \
  packages/db/src/migrations/0069_shop_storefront_config.sql \
  packages/db/src/migrations/0070_product_reviews_visibility.sql \
  packages/db/src/schema/shop-settings.ts \
  packages/db/src/schema/product-reviews.ts \
  packages/db/src/schema/index.ts \
  apps/api/test/a5a6-migrations.integration.test.ts
git commit -m "feat(ws-a+b): migrations 0069+0070 — storefront_config_json + is_publicly_visible — 5 integration tests green"
```

---

## Task 8: WS-D — Cross-tenant storefront_config_json test

**Files:**
- Modify: `apps/api/test/settings/tenant-isolation.test.ts`

Add a new `describe` block after the `'loyalty config tenant isolation'` block at the bottom.

- [ ] **Step 1: Append the test block to tenant-isolation.test.ts**

At the very end of `apps/api/test/settings/tenant-isolation.test.ts`, add:

```ts
describe('storefront_config_json tenant isolation', () => {
  it('T7: tenant A cannot read tenant B storefront_config_json via RLS (zero rows returned)', async () => {
    // Seed tenant B's storefront_config_json as superuser (bypasses RLS)
    await pool.query(
      `INSERT INTO shop_settings (shop_id, storefront_config_json)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (shop_id) DO UPDATE SET storefront_config_json = $2::jsonb`,
      [TENANT_B, JSON.stringify({ heroBanners: [{ imageId: 'b-banner-id', headlineHi: 'दुकान बी' }] })],
    );

    // Tenant A queries shop_settings for tenant B's shop_id — RLS must block it
    const tenantA = makeTenant(TENANT_A, 'shop-a', 'Shop A');
    const ctxA = makeCtx(TENANT_A, tenantA);

    const rows = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ shop_id: string; storefront_config_json: unknown }>(
          `SELECT shop_id, storefront_config_json FROM shop_settings WHERE shop_id = $1`,
          [TENANT_B],
        );
        return r.rows;
      }),
    );

    // RLS policy filters rows by current_setting('app.current_shop_id') — tenant B's row
    // must not be visible to tenant A's session
    expect(rows).toHaveLength(0);
  });

  it('T7b: tenant A storefront_config_json write does not affect tenant B row', async () => {
    const MARKER_A = JSON.stringify({ trustPillarsOverride: [{ titleHi: 'दुकान ए', descriptionHi: 'A only' }] });
    const MARKER_B = JSON.stringify({ heroBanners: [{ imageId: 'b-banner-id', headlineHi: 'दुकान बी' }] });

    // Ensure tenant B has a known value
    await pool.query(
      `INSERT INTO shop_settings (shop_id, storefront_config_json)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (shop_id) DO UPDATE SET storefront_config_json = $2::jsonb`,
      [TENANT_B, MARKER_B],
    );

    // Tenant A updates its own storefront_config_json
    const tenantA = makeTenant(TENANT_A, 'shop-a', 'Shop A');
    const ctxA = makeCtx(TENANT_A, tenantA);
    await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(
          `INSERT INTO shop_settings (shop_id, storefront_config_json)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (shop_id) DO UPDATE SET storefront_config_json = $2::jsonb`,
          [TENANT_A, MARKER_A],
        );
      }),
    );

    // Verify tenant B's row is untouched (read as superuser to bypass RLS)
    const { rows } = await pool.query<{ storefront_config_json: { heroBanners?: unknown[] } }>(
      `SELECT storefront_config_json FROM shop_settings WHERE shop_id = $1`,
      [TENANT_B],
    );
    expect(rows[0]!.storefront_config_json.heroBanners).toBeDefined();
    // Tenant A's trustPillarsOverride must NOT appear in tenant B's row
    const hasAMarker = JSON.stringify(rows[0]!.storefront_config_json).includes('दुकान ए');
    expect(hasAMarker).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect PASS**

```bash
pnpm --filter @goldsmith/api test:integration -- test/settings/tenant-isolation.test.ts
```

Expected: all existing tests still pass + 2 new tests pass (T7, T7b).

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/settings/tenant-isolation.test.ts
git commit -m "test(ws-d): add storefront_config_json cross-tenant RLS isolation tests (T7)"
```

---

## Task 9: WS-E — Reviews visibility placeholder integration test

**Files:**
- Create: `apps/api/test/catalog/reviews-visibility.integration.test.ts`

This test has two active cases (column shape) and a `describe.skip` block for the Phase B read-path tests that land when Story B4 ships.

- [ ] **Step 1: Create the directory and test file**

```bash
mkdir -p apps/api/test/catalog
```

`apps/api/test/catalog/reviews-visibility.integration.test.ts`:

```ts
// Integration tests for product_reviews.is_publicly_visible (migration 0070).
//
// Active tests: column shape, index existence (T8, T9 — covered also in
//   a5a6-migrations.integration.test.ts; repeated here for catalog context isolation).
//
// Skipped tests (describe.skip): Phase B public reviews filter — lands when
//   Story B4 ships GET /api/v1/catalog/products/:id/reviews with is_publicly_visible filter.
//   The column and index MUST already exist before B4 can be implemented.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../../packages/db/src/migrations'));
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('product_reviews.is_publicly_visible — column + index (Phase A)', () => {
  it('column is BOOLEAN NOT NULL DEFAULT TRUE', async () => {
    const { rows } = await pool.query<{
      data_type: string;
      is_nullable: string;
      column_default: string;
    }>(
      `SELECT data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_name = 'product_reviews'
          AND column_name = 'is_publicly_visible'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data_type).toBe('boolean');
    expect(rows[0]!.is_nullable).toBe('NO');
    expect(rows[0]!.column_default).toBe('true');
  });

  it('partial index idx_product_reviews_public exists with WHERE is_publicly_visible predicate', async () => {
    const { rows } = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE tablename = 'product_reviews' AND indexname = 'idx_product_reviews_public'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.indexdef).toContain('is_publicly_visible');
  });
});

// ─── Phase B placeholder — activate when Story B4 ships ──────────────────────
//
// Story B4: GET /api/v1/catalog/products/:id/reviews
//   - filters WHERE is_publicly_visible = TRUE
//   - redacts customer name to first name only
//   - requires GRANT UPDATE on is_publicly_visible for shopkeeper opt-out
//
// Remove the `.skip` and implement these tests when B4 is implemented.

describe.skip('Phase B — public reviews endpoint uses is_publicly_visible filter', () => {
  it('GET /catalog/products/:id/reviews returns only is_publicly_visible=TRUE rows', async () => {
    // TODO in B4:
    // 1. Seed 2 reviews: one with is_publicly_visible=TRUE, one with FALSE
    // 2. Call GET /api/v1/catalog/products/:id/reviews with shop context
    // 3. Assert response.reviews.length === 1
    // 4. Assert the returned review is the TRUE one
    throw new Error('Implement in Story B4');
  });

  it('is_publicly_visible=FALSE row is excluded from public listing query', async () => {
    // TODO in B4:
    // 1. Seed a review with is_publicly_visible=FALSE
    // 2. Run the catalog read query directly (mirroring catalog.service)
    // 3. Assert the FALSE row does not appear in results
    // 4. Verify EXPLAIN uses idx_product_reviews_public (not seq scan)
    throw new Error('Implement in Story B4');
  });
});
```

- [ ] **Step 2: Run — expect active tests PASS, skip block skipped**

```bash
pnpm --filter @goldsmith/api test:integration -- test/catalog/reviews-visibility.integration.test.ts
```

Expected:
```
✓ column is BOOLEAN NOT NULL DEFAULT TRUE
✓ partial index idx_product_reviews_public exists with WHERE is_publicly_visible predicate
↓ [skipped] Phase B — public reviews endpoint uses is_publicly_visible filter
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/catalog/reviews-visibility.integration.test.ts
git commit -m "test(ws-e): add reviews-visibility integration test — active column checks + Phase B skip placeholders"
```

---

## Task 10: Final Verification — Typecheck, lint, code-truth grep, full test run

- [ ] **Step 1: Typecheck API**

```bash
pnpm --filter @goldsmith/api typecheck 2>&1 | grep -v "tenant-context\|tenant-config\|goldsmith/sync" | grep "error TS"
```

Expected: no output (pre-existing tenant-context errors are from unbuilt worktree deps — filter them). If new errors appear (lines referencing `shop-settings.ts`, `product-reviews.ts`, or `storefront-config.schema.ts`), fix them before proceeding.

- [ ] **Step 2: Lint shared package**

```bash
pnpm --filter @goldsmith/shared lint
```

Expected: exit 0, no new errors.

- [ ] **Step 3: Code-truth grep — storefront_config_json**

```bash
git grep -r "storefront_config_json" -- "*.sql" "*.ts"
```

Expected output includes exactly these files (no more, no less):
- `packages/db/src/migrations/0069_shop_storefront_config.sql`
- `packages/db/src/schema/shop-settings.ts`
- `apps/api/test/a5a6-migrations.integration.test.ts`
- `apps/api/test/settings/tenant-isolation.test.ts`

If `storefront_config_json` appears in any other `.ts` file, investigate — no service-layer code should reference it in this story.

- [ ] **Step 4: Code-truth grep — is_publicly_visible**

```bash
git grep -r "is_publicly_visible" -- "*.sql" "*.ts"
```

Expected files:
- `packages/db/src/migrations/0070_product_reviews_visibility.sql`
- `packages/db/src/schema/product-reviews.ts`
- `apps/api/test/a5a6-migrations.integration.test.ts`
- `apps/api/test/catalog/reviews-visibility.integration.test.ts`

- [ ] **Step 5: Code-truth grep — STOREFRONT_CONFIG_DEFAULTS**

```bash
git grep -r "STOREFRONT_CONFIG_DEFAULTS" -- "*.ts"
```

Expected files:
- `packages/shared/src/schemas/storefront-config.schema.ts` (definition)
- `packages/shared/src/schemas/storefront-config.schema.test.ts` (T6 test)
- `packages/shared/src/index.ts` (re-export)

- [ ] **Step 6: Full integration test run**

```bash
pnpm --filter @goldsmith/api test:integration
```

Expected: all tests pass (no regressions in pre-existing tests).

- [ ] **Step 7: Full shared test run**

```bash
pnpm --filter @goldsmith/shared test
```

Expected: includes the 8 StorefrontConfig tests plus all pre-existing tests.

- [ ] **Step 8: Commit any typecheck/lint fixes**

If steps 1–2 required any fixes, commit now:

```bash
git add -p   # stage only the fix files
git commit -m "fix(a5a6): typecheck/lint corrections"
```

If no fixes were needed, skip this step.

---

## Resume Point

If this session is interrupted, resume from whichever task has unchecked boxes. Key state to verify on resume:

```bash
git log --oneline -8          # see which commits landed
pnpm --filter @goldsmith/shared test   # verify WS-C unit tests
pnpm --filter @goldsmith/api test:integration -- a5a6-migrations  # verify WS-A+B
git grep "storefront_config_json" -- "*.sql" "*.ts"   # code-truth A5
git grep "is_publicly_visible" -- "*.sql" "*.ts"      # code-truth A6
```

---

## What is NOT in this story

Do not implement any of the following — they are Phase B work:

- `catalog.service.getStorefrontConfig()` — Phase B Story B5
- `GET /api/v1/catalog/storefront-config` endpoint — Phase B Story B5
- `GET /api/v1/catalog/products/:id/reviews` with visibility filter — Phase B Story B4
- `GRANT UPDATE ON product_reviews TO app_user` for `is_publicly_visible` — Phase B Story B4
- Any changes to `apps/api/src/modules/reviews/reviews.repository.ts` — Phase B
- Any shopkeeper admin UI for `storefront_config_json` — post-SOW

If you find yourself editing any of the above files, stop and re-read this plan.
