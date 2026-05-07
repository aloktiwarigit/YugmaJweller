# Story A2 — Collections + collection_products Tables: Design Spec

Date: 2026-05-06  
Branch: `feat/storefront-collections-a2`  
Migration: `0067_collections.sql`  
Class: **A** (new RLS-enforced tenant tables)

---

## Context

Story A2 is the second Phase A schema story in the Goldsmith Customer Storefront Uplift plan. It adds two new tables — `collections` and `collection_products` — that power the storefront's collection browsing, mega-menu groups, and curated homepage sections. The tables must be RLS-enforced and use composite `(shop_id, ...)` foreign keys throughout so cross-tenant references are impossible at the schema layer.

This story owns **migration 0067 only**. Migrations 0066 and 0068 are in worktree `gs-stf-1`; 0069–0070 are in worktree `gs-stf-3`. Merge order: 0066 → 0067 → 0068 → 0069 → 0070.

---

## Locked Decisions

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Slug enforcement level | **DB CHECK constraint** + Zod in app layer | Slugs appear in public URLs; DB is authoritative; regex is stable; app layer adds defense-in-depth |
| 2 | hero_image_id source | **Reuse `product_images`** via composite FK | Already has scan_status, CDN pipeline, RLS — no new infrastructure for demo phase |
| 3 | Cascade on collection delete | **ON DELETE CASCADE** on join rows; products untouched | "Remove curation, keep product" semantics; auto-clean orphaned join rows on product delete too |

---

## Pre-condition: product_images Missing UNIQUE(shop_id, id)

**Critical finding from pre-flight:** Neither migration 0057 nor 0058 added `UNIQUE(shop_id, id)` to `product_images`. Without it, PostgreSQL cannot accept a composite FK target on `(shop_id, id)`. Migration 0067 must add this constraint first:

```sql
ALTER TABLE product_images
  ADD CONSTRAINT product_images_shop_id_id_uniq UNIQUE (shop_id, id);
```

This is a pure metadata operation (id is already PRIMARY KEY, so the column pair is trivially unique — no row rewrite, no data movement).

---

## Migration 0067 DDL

### Step 1 — Pre-condition: add UNIQUE(shop_id, id) to product_images

```sql
ALTER TABLE product_images
  ADD CONSTRAINT product_images_shop_id_id_uniq UNIQUE (shop_id, id);
```

### Step 2 — Create `collections`

```sql
CREATE TABLE collections (
  shop_id       UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT        NOT NULL
                            CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_hi      TEXT        NOT NULL,
  title_en      TEXT,
  subtitle_hi   TEXT,
  hero_image_id UUID,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  is_premium    BOOLEAN     NOT NULL DEFAULT FALSE,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT collections_shop_slug_uniq    UNIQUE (shop_id, slug),
  CONSTRAINT collections_shop_id_id_uniq   UNIQUE (shop_id, id),
  CONSTRAINT collections_shop_image_fkey
    FOREIGN KEY (shop_id, hero_image_id)
    REFERENCES product_images (shop_id, id)
    ON DELETE SET NULL
);
```

Index on listing hot path:
```sql
CREATE INDEX collections_listing_idx
  ON collections (shop_id, sort_order)
  WHERE published_at IS NOT NULL;
```

RLS:
```sql
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_collections_tenant_isolation ON collections;
CREATE POLICY rls_collections_tenant_isolation ON collections
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

REVOKE ALL ON collections FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON collections TO app_user;
```

### Step 3 — Create `collection_products`

```sql
CREATE TABLE collection_products (
  shop_id       UUID        NOT NULL,
  collection_id UUID        NOT NULL,
  product_id    UUID        NOT NULL,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (shop_id, collection_id, product_id),

  CONSTRAINT cp_shop_collection_fkey
    FOREIGN KEY (shop_id, collection_id)
    REFERENCES collections (shop_id, id)
    ON DELETE CASCADE,

  CONSTRAINT cp_shop_product_fkey
    FOREIGN KEY (shop_id, product_id)
    REFERENCES products (shop_id, id)
    ON DELETE CASCADE
);
```

Indexes:
```sql
-- Products-in-collection list (primary access pattern)
CREATE INDEX collection_products_list_idx
  ON collection_products (shop_id, collection_id, sort_order);

-- Reverse lookup: which collections does this product appear in?
CREATE INDEX collection_products_product_idx
  ON collection_products (shop_id, product_id);
```

RLS:
```sql
ALTER TABLE collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_products FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_collection_products_tenant_isolation ON collection_products;
CREATE POLICY rls_collection_products_tenant_isolation ON collection_products
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

REVOKE ALL ON collection_products FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON collection_products TO app_user;
```

---

## Drizzle Schema

### `packages/db/src/schema/collections.ts` (new file)

```typescript
import { uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

export const collections = tenantScopedTable('collections', {
  id:            uuid('id').primaryKey().defaultRandom(),
  slug:          text('slug').notNull(),
  title_hi:      text('title_hi').notNull(),
  title_en:      text('title_en'),
  subtitle_hi:   text('subtitle_hi'),
  hero_image_id: uuid('hero_image_id'),
  sort_order:    integer('sort_order').notNull().default(0),
  is_premium:    boolean('is_premium').notNull().default(false),
  published_at:  timestamp('published_at', { withTimezone: true }),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const collectionProducts = tenantScopedTable('collection_products', {
  collection_id: uuid('collection_id').notNull(),
  product_id:    uuid('product_id').notNull(),
  sort_order:    integer('sort_order').notNull().default(0),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Constraint note:** Composite FKs, the `CHECK slug ~` regex, `UNIQUE(shop_id, slug)`, and `UNIQUE(shop_id, id)` are expressed in the SQL migration (source of truth). Drizzle schema is the TypeScript type layer only. Do not attempt to express unsupported constraint types in Drizzle DSL.

### `packages/db/src/schema/index.ts` (modify)

Add:
```typescript
export * from './collections';
```

---

## Mandatory Test Assertions

All 5 brief assertions plus 2 additional constraint assertions derived from the design.

### WS-C: Tenant-isolation (cross-tenant FK bypass attempts)

**Test 1 — `hero_image_id` composite FK blocks cross-tenant assignment**
```
Given: shop_a, shop_b; image_b owned by shop_b
When:  SET app.current_shop_id = shop_a
       INSERT INTO collections (shop_id, hero_image_id, ...) VALUES (shop_a, image_b, ...)
Then:  FK violation (composite (shop_a, image_b) not found in product_images)
```

**Test 2 — `collection_products` composite FK blocks cross-tenant product linkage**
```
Given: shop_a has collection_a; shop_b has product_b
When:  INSERT INTO collection_products (shop_id, collection_id, product_id) VALUES (shop_a, collection_a, product_b)
Then:  FK violation (composite (shop_a, product_b) not found in products)
```

**Test 3 — RLS blocks cross-tenant SELECT**
```
Given: shop_a has collection_a; shop_b has collection_b
When:  SET app.current_shop_id = shop_a; SELECT * FROM collections
Then:  only collection_a returned; collection_b invisible
```

### WS-D: Cascade behavior

**Test 4 — Collection delete cascades join rows, products untouched**
```
Given: collection_c linked to product_1, product_2, product_3 via collection_products
When:  DELETE FROM collections WHERE id = collection_c
Then:  collection_products rows for collection_c = 0
       products rows for product_1, product_2, product_3 still exist
```

**Test 5 — Product delete cascades join rows, collections untouched**
```
Given: product_p linked to collection_x and collection_y
When:  DELETE FROM products WHERE id = product_p
Then:  collection_products rows for product_p = 0
       collection_x and collection_y still exist
```

### WS-E: Constraint enforcement

**Test 6 — UNIQUE(shop_id, slug) enforced across tenants**
```
shop_a INSERT slug 'bridal-2026' → success
shop_a INSERT slug 'bridal-2026' again → unique violation
shop_b INSERT slug 'bridal-2026' → success (different tenant)
```

**Test 7 — DB CHECK rejects invalid slug formats**
```
'bridal_2026'   → CHECK violation (underscore)
'Bridal-2026'   → CHECK violation (uppercase)
'bridal-'       → CHECK violation (trailing hyphen)
'-bridal'       → CHECK violation (leading hyphen)
'bridal-2026'   → passes
'new'           → passes (single word, no hyphens)
```

---

## Work Streams

| WS | Scope | Notes |
|----|-------|-------|
| WS-A | Migration 0067 DDL + RLS + constraints + indexes | Full DDL as above |
| WS-B | Drizzle schema (`collections.ts`) + index.ts export | Follow `products.ts` pattern |
| WS-C | Tenant-isolation tests (Tests 1–3) | Run against real Postgres |
| WS-D | Cascade behavior tests (Tests 4–5) | |
| WS-E | Constraint + index tests (Tests 6–7 + EXPLAIN smoke) | |

---

## Non-Negotiable Floor

- Composite `(shop_id, ...)` FK on every FK column — never plain FKs
- `ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;` on both tables
- `REVOKE ALL` before explicit GRANT
- `app.current_shop_id` GUC pattern (not session variables) for RLS
- `BEGIN; ... COMMIT;` wrapping all DDL
- No FLOAT columns (not applicable here, but verified)
- Drizzle schema exported from `packages/db/src/schema/index.ts`

---

## Rollback Plan

```sql
ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_shop_image_fkey;
DROP TABLE IF EXISTS collection_products CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
ALTER TABLE product_images DROP CONSTRAINT IF EXISTS product_images_shop_id_id_uniq;
```

---

## Verification Commands

```bash
# After applying migration
psql $DATABASE_URL -c "\d collections"
psql $DATABASE_URL -c "\d collection_products"
psql $DATABASE_URL -c "\d product_images" | grep shop_id_id_uniq

# Typecheck
pnpm --filter @goldsmith/db build

# Tests
pnpm --filter @goldsmith/api test -- --testPathPattern="collections"

# Seed smoke (after migration applied)
psql $DATABASE_URL <<'SQL'
SET app.current_shop_id = '<anchor-dev-shop-id>';
INSERT INTO collections (shop_id, slug, title_hi) VALUES ('<anchor-dev-shop-id>', 'bridal-2026', 'ब्राइडल कलेक्शन 2026');
SELECT id, slug, title_hi FROM collections;
SQL
```
