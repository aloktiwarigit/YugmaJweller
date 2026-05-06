# Story A5+A6 — Storefront Config JSONB + Reviews Visibility

**Date:** 2026-05-06  
**Branch:** `feat/storefront-config-a5a6`  
**Worktree:** `C:\gs-stf-3`  
**Class:** A (PII surface + tenant config column additions)  
**Migrations reserved:** 0069 (A5), 0070 (A6)  
**Parent plan:** `C:\Users\alokt\.claude\plans\review-docs-customer-web-aspirational-st-fizzy-token.md` (Phase A, stories A5+A6)

---

## Context

Phase A of the Goldsmith Storefront Uplift adds the schema foundation (migrations 0066–0070) before any API or UI work. This story covers the two smallest migrations in that set — both Class A because they touch RLS-adjacent tables and a PII-adjacent surface.

**A5** adds `storefront_config_json JSONB` to `shop_settings`, giving each tenant a JSONB blob for homepage curation (hero banners, featured collections, gift personas, brand palette, trust pillars). The field is validated via a Zod schema in `packages/shared`; the DB stores `'{}'` and the service merges code-side defaults on read. **No service-layer or API code changes in this story** — `catalog.service.getStorefrontConfig()` that calls the merge lands in Phase B (Story B5).

**A6** adds `is_publicly_visible BOOLEAN` to `product_reviews`. All existing reviews were public before this column; the TRUE default preserves that contract. **No app-code changes in this story** — the public reviews endpoint that reads this column lands in Phase B (Story B4). Customer opt-out and shopkeeper moderation land in Phase B as well.

Sister worktrees in flight: `C:/gs-stf-1` (0066+0068), `C:/gs-stf-2` (0067), `C:/gs-stf-4` (A4, no migration). Merge order: 0066+0068 → 0067 → 0069+0070 (this) → A4.

---

## Locked Decisions

### D1: JSONB blob, not separate columns
`shop_settings` already stores `making_charges_json`, `wastage_json`, `loyalty_json`, `notification_prefs_json` as JSONB blobs with code-side Zod validation. Following that pattern avoids a departure that would need an ADR, keeps schema migration small, and defers column-level indexability decisions until actual query patterns demand them. GIN indexes on individual keys can be added later without breaking the shape contract.

### D2: Code-side default merge
Every JSONB config in this codebase has a corresponding `*_DEFAULTS` constant in `packages/shared` (`MAKING_CHARGE_DEFAULTS`, `WASTAGE_DEFAULTS`, `LOYALTY_DEFAULTS`, `NOTIFICATION_PREFS_DEFAULTS`). The DB column stores `'{}'` until a tenant overrides. The service merges the constant on read. This story introduces `STOREFRONT_CONFIG_DEFAULTS` following the same pattern. No DB-side trigger or generated column.

### D3: `is_publicly_visible` defaults TRUE (opt-out, DPDPA-aware)
Migration 0047 created `product_reviews` with no visibility column — all rows were public from the start. Backfilling to FALSE would silently hide reviews customers expected to be public. TRUE preserves the existing contract. Per DPDPA, this is an opt-out model: customers and shopkeepers can suppress reviews post-submission, but the initial display aligns with what the customer accepted when submitting. This must be documented in the migration comment. Customer opt-out UI is a Phase B story.

### D4: No UPDATE grant addition for product_reviews
Migration 0047 grants only `SELECT, INSERT` to `app_user` on `product_reviews`. The `is_publicly_visible` column is set at insert time (defaulting TRUE). The shopkeeper's ability to set `is_publicly_visible = FALSE` on a row requires an UPDATE grant — that lands in Phase B (Story B4) alongside the endpoint that uses it. This migration grants nothing new.

### D5: Partial index alongside existing, not replacing
`idx_product_reviews_product` (on `(shop_id, product_id, created_at DESC)` — no predicate) serves the shopkeeper's private review list. The public listing in Phase B needs only visible rows. Adding a partial index `WHERE is_publicly_visible = TRUE` alongside the existing one is correct; dropping the old one would break the shopkeeper path.

---

## A5 — `shop_settings.storefront_config_json`

### Migration 0069

```sql
-- 0069_shop_storefront_config.sql
-- Add storefront_config_json JSONB column to shop_settings.
--
-- Shape is enforced at the API layer via StorefrontConfigSchema in @goldsmith/shared.
-- The DB stores '{}' (empty object) until a tenant overrides; the service merges
-- STOREFRONT_CONFIG_DEFAULTS on read. No DB-side trigger or generated column.
--
-- RLS: shop_settings already has rls_shop_settings_tenant_isolation covering FOR ALL —
-- no new policy needed.
-- GRANT: existing GRANT SELECT, INSERT, UPDATE ON shop_settings TO app_user covers
-- the new column — no new grant needed.

ALTER TABLE shop_settings
  ADD COLUMN storefront_config_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN shop_settings.storefront_config_json IS
  'Tenant homepage curation config. DB stores empty {}; API merges STOREFRONT_CONFIG_DEFAULTS. '
  'Zod-validated via StorefrontConfigSchema in @goldsmith/shared.';
```

### Drizzle schema (`packages/db/src/schema/shop-settings.ts`)

Add to the `tenantSingletonTable` call:
```ts
storefront_config_json: jsonb('storefront_config_json').notNull().default({}),
```

### Zod schema (`packages/shared/src/schemas/storefront-config.schema.ts`)

New file. Must be importable by `apps/api` now and by `packages/customer-shared` in Phase A4 (which re-exports from `@goldsmith/shared`).

```ts
import { z } from 'zod';

export const HeroBannerSchema = z.object({
  imageId:     z.string().uuid(),
  headlineHi:  z.string().min(1).max(120),
  headlineEn:  z.string().max(120).optional(),
  ctaUrl:      z.string().regex(/^\//, 'must be an internal route starting with /'),
  validFrom:   z.string().datetime().optional(),
  validTo:     z.string().datetime().optional(),
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
  heroBanners:            z.array(HeroBannerSchema).default([]),
  featuredCollectionIds:  z.array(z.string().uuid()).default([]),
  premiumCollectionIds:   z.array(z.string().uuid()).default([]),
  giftPersonaOverrides:   z.array(GiftPersonaOverrideSchema).default([]),
  brandPalette:           BrandPaletteSchema.default({}),
  trustPillarsOverride:   z.array(TrustPillarSchema).default([]),
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
    { titleHi: 'BIS हॉलमार्क',       titleEn: 'BIS Hallmark',      descriptionHi: 'सोने की शुद्धता प्रमाणित' },
    { titleHi: 'HUID ट्रैकिंग',      titleEn: 'HUID Tracking',     descriptionHi: 'हर आभूषण का विशेष ID' },
    { titleHi: 'एक्सचेंज',           titleEn: 'Exchange',          descriptionHi: 'पुराने सोने पर उचित मूल्य' },
    { titleHi: 'बायबैक',             titleEn: 'Buyback',           descriptionHi: 'खरीदी कीमत की गारंटी' },
    { titleHi: 'ट्राई एट होम',       titleEn: 'Try at Home',       descriptionHi: 'घर पर देखें, पसंद आए तो लें' },
  ],
};
```

### `packages/shared/src/index.ts` additions

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

---

## A6 — `product_reviews.is_publicly_visible`

### Migration 0070

```sql
-- 0070_product_reviews_visibility.sql
-- Add is_publicly_visible BOOLEAN to product_reviews.
--
-- DPDPA NOTE: Default is TRUE (opt-out model).
-- All rows in this table were publicly visible before this migration — the original
-- table (0047) had no visibility control. Backfilling to FALSE would silently hide
-- reviews customers expected to be public. TRUE preserves the existing contract.
-- Customer opt-out and shopkeeper moderation endpoints land in Phase B (Story B4),
-- which also adds the GRANT UPDATE on this column to app_user.
--
-- Index strategy:
--   idx_product_reviews_product (no predicate) — kept; serves shopkeeper private list.
--   idx_product_reviews_public (partial, WHERE is_publicly_visible = TRUE) — new;
--     serves the Phase B public reviews endpoint. Adding alongside avoids breaking
--     the shopkeeper read path.

ALTER TABLE product_reviews
  ADD COLUMN is_publicly_visible BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN product_reviews.is_publicly_visible IS
  'TRUE = show on public PDP reviews section. Default TRUE (opt-out). '
  'Customer/shopkeeper opt-out via Phase B Story B4 endpoint.';

CREATE INDEX idx_product_reviews_public
  ON product_reviews(shop_id, product_id, created_at DESC)
  WHERE is_publicly_visible = TRUE;
```

### Drizzle schema (`packages/db/src/schema/product-reviews.ts`)

Add:
```ts
is_publicly_visible: boolean('is_publicly_visible').notNull().default(true),
```

---

## 5 Work Streams

### WS-A: Migration 0069 + Drizzle shop_settings

Files:
- `packages/db/src/migrations/0069_shop_storefront_config.sql` (new)
- `packages/db/src/schema/shop-settings.ts` (add column)

TDD:
- Red: write integration test asserting `storefront_config_json` column exists and defaults to `'{}'`
- Red: write RLS cross-tenant write-block test
- Green: apply migration + Drizzle update
- Refactor: verify `GRANT UPDATE` not duplicated

### WS-B: Migration 0070 + Drizzle product_reviews

Files:
- `packages/db/src/migrations/0070_product_reviews_visibility.sql` (new)
- `packages/db/src/schema/product-reviews.ts` (add column)

TDD:
- Red: integration test asserting `is_publicly_visible` column exists and defaults to TRUE on new rows
- Red: EXPLAIN test for partial index
- Green: apply migration + Drizzle update
- Refactor: confirm existing index not dropped

### WS-C: Zod schema + unit tests

Files:
- `packages/shared/src/schemas/storefront-config.schema.ts` (new)
- `packages/shared/src/schemas/storefront-config.schema.test.ts` (new)
- `packages/shared/src/index.ts` (add exports)

TDD:
- Red: 7 unit tests (see Mandatory Test Assertions below)
- Green: implement `StorefrontConfigSchema` + `STOREFRONT_CONFIG_DEFAULTS`
- Refactor: extract sub-schemas for readability

### WS-D: Tenant-isolation integration tests for storefront_config_json

Files:
- `apps/api/test/settings/settings.integration.test.ts` (add storefront-config section)

TDD:
- Red: test asserting shop_a RLS context cannot UPDATE shop_b `storefront_config_json`
- Green: confirm migration 0069 RLS policy covers it (inherits from existing policy)
- Refactor: assert no GRANT UPDATE was added unnecessarily

### WS-E: Reviews visibility placeholder integration test

Files:
- `apps/api/test/reviews-visibility.integration.test.ts` (new, `.skip` on Phase B cases)

TDD:
- Write `describe('is_publicly_visible column', ...)` with:
  - Active test: column exists, defaults TRUE on INSERT
  - Active test: partial index shown in EXPLAIN
  - Skipped test: `describe.skip('Phase B — public listing filter', ...)`

---

## Mandatory Test Assertions

Per `feedback_spec_lessons_need_plan_assertions.md` — every known-issue maps to a test:

| # | Assertion | WS | Test type |
|---|---|---|---|
| T1 | `'storefront_config_json defaults to empty object'` — fresh shop_settings row has `'{}'::jsonb`, not NULL | WS-A | Integration |
| T2 | `'storefront_config_json round-trips through Zod'` — write a full config, read it, parse with `StorefrontConfigSchema`, all sub-schema defaults applied | WS-C | Unit |
| T3 | `'ctaUrl that is not internal is rejected'` — `'https://example.com/foo'` throws ZodError | WS-C | Unit |
| T4 | `'brandPalette accentMode enum rejects unknown value'` — `'neon'` throws ZodError | WS-C | Unit |
| T5 | `'empty object parses and applies all defaults'` — `StorefrontConfigSchema.parse({})` returns `STOREFRONT_CONFIG_DEFAULTS` shape | WS-C | Unit |
| T6 | `'STOREFRONT_CONFIG_DEFAULTS.trustPillarsOverride has 5 entries'` | WS-C | Unit |
| T7 | `'storefront_config_json RLS blocks cross-tenant write'` — shop_a context cannot UPDATE shop_b settings row | WS-D | Integration |
| T8 | `'is_publicly_visible defaults to TRUE on new rows'` — INSERT without the column → value is TRUE | WS-B | Integration |
| T9 | `'partial index used by public listing query'` — EXPLAIN on `WHERE shop_id=$1 AND product_id=$2 AND is_publicly_visible ORDER BY created_at DESC LIMIT 10` shows index scan on `idx_product_reviews_public` | WS-B | Integration |
| T10 | `'is_publicly_visible=FALSE row excluded from partial index scan'` — insert one review with FALSE, EXPLAIN does not include it in the index scan result set | WS-B | Integration |
| T11 | `'imageId in heroBanner must be valid UUID'` — non-UUID string throws ZodError | WS-C | Unit |

---

## Non-negotiable Floor

- No FLOAT, no cross-tenant queries in any test helpers
- `storefront_config_json` column: `JSONB NOT NULL DEFAULT '{}'::jsonb` — never nullable
- `is_publicly_visible`: `BOOLEAN NOT NULL DEFAULT TRUE` — never nullable
- Migration comments document DPDPA rationale and GRANT reasoning
- `StorefrontConfigSchema` exported from `packages/shared`, not `apps/api`
- Existing `idx_product_reviews_product` index NOT dropped
- `ctaUrl` regex prevents open-redirect: `/^\/` enforced at Zod layer

---

## Review Gate

Class A ceremony, both gates parallel before push:

1. `codex review --base main` — write `.codex-review-passed` marker on success. Per `feedback_codex_worktree_clm.md`: if Codex fails in Windows worktree, run from main repo against this branch as remote ref, OR substitute with `/security-review` + Opus review chain (note in commit).
2. `/security-review` — write `.security-review-passed` marker. Required because A6 touches a PII surface (public reviews expose customer names).

Both markers required before `git push`.

---

## Runtime Smoke

Apply both migrations to local Postgres, then verify:

```sql
-- A5
\d shop_settings
-- expect: storefront_config_json | jsonb | not null | default '{}'::jsonb

-- A6
\d product_reviews
-- expect: is_publicly_visible | boolean | not null | default true

\di idx_product_reviews_public
-- expect: partial index on (shop_id, product_id, created_at DESC) WHERE is_publicly_visible
```

---

## Code-truth Checklist (before PR)

```bash
git grep -r "storefront_config_json" -- "*.sql" "*.ts"
# expect: 0069 migration, shop-settings.ts schema, storefront-config.schema.ts tests

git grep -r "is_publicly_visible" -- "*.sql" "*.ts"
# expect: 0070 migration, product-reviews.ts schema, reviews-visibility test

git grep -r "STOREFRONT_CONFIG_DEFAULTS" -- "*.ts"
# expect: storefront-config.schema.ts definition, index.ts re-export, test file usage
```
