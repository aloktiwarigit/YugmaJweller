# A1+A3 Products Storefront Schema — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 9 storefront columns to `products` (migration 0066) and a composite-FK-guarded `primary_image_id` column with a SECURITY INVOKER auto-maintain trigger (migration 0068), proven by all 6 mandatory spec tests.

**Architecture:** Two independent SQL migrations applied in strict numeric sequence. All behaviour proven by Testcontainer integration tests following the exact pattern of `product-images-tenant-fk.integration.test.ts`. Drizzle schema updated to match DDL. No API or UI changes in this story — pure data layer.

**Tech Stack:** PostgreSQL 15, Drizzle ORM 0.30 (`smallint`, `bigint`, `text().array()`), Vitest 1.x, `@testcontainers/postgresql`, `@goldsmith/db` (`runMigrations`, `createPool`, `withTenantTx`), `@goldsmith/tenant-context`.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `packages/db/src/migrations/0066_products_storefront_columns.sql` | WS-A: 9 new columns + 7 indexes + pg_trgm |
| Create | `packages/db/src/migrations/0068_products_primary_image.sql` | WS-B: composite FK + backfill + SECURITY INVOKER trigger |
| Create | `apps/api/test/storefront-schema-0066.integration.spec.ts` | WS-E: T3-T6 + weight invariant tests |
| Create | `apps/api/test/storefront-schema-0068.integration.spec.ts` | WS-C+D: T1 (FK cross-tenant) + T2 (trigger RLS) |
| Modify | `packages/db/src/schema/products.ts` | WS-F: Drizzle column additions + `CATALOG_STYLES` export |

**Migration constraint:** `0067` is reserved for the collections worktree (`C:\gs-stf-2`). Never create that file on this branch.

---

## Task 1 — [WS-E Red] Write failing 0066 behaviour tests

**Files:**
- Create: `apps/api/test/storefront-schema-0066.integration.spec.ts`

**Context:** `runMigrations` applies every `.sql` file in `packages/db/src/migrations/` in alphabetical order. Until `0066_*.sql` exists, `products` has no `style`, `occasion`, `gift_persona`, etc. columns. Every test in this file will fail with `column "style" does not exist` (Postgres error 42703) — that IS the Red failure.

- [ ] **Step 1: Create the test file**

```typescript
// apps/api/test/storefront-schema-0066.integration.spec.ts
//
// Mandatory spec tests T3–T6 + weight-column invariant.
// UUID prefix cc4xxxxx — non-overlapping with other test files.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

// ---------------------------------------------------------------------------
// Fixture UUIDs — non-overlapping with other integration test files
// ---------------------------------------------------------------------------
const SHOP_A = 'cc400001-cc00-4000-cc00-000000000001';

const tenantA: Tenant = { id: SHOP_A, slug: 'stf-0066-a', display_name: '0066 Shop A', status: 'ACTIVE' };
const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };

let container: StartedPostgreSqlContainer;
let pool: Pool;
let userAId: string;
let productAId: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed shop via raw connection (no RLS on shops table from admin path)
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'stf-0066-a', '0066 Shop A', 'ACTIVE')`,
      [SHOP_A],
    );
  } finally {
    c.release();
  }

  // Seed shop_admin user
  userAId = await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
           VALUES ($1, '+919400000101', 'Owner 0066', 'shop_admin', 'ACTIVE') RETURNING id`,
        [SHOP_A],
      );
      return r.rows[0]!.id;
    }),
  );

  // Seed a published product for index smoke tests (partial indexes filter published_at IS NOT NULL)
  productAId = await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g,
            status, created_by_user_id, published_at, published_by_user_id)
         VALUES
           ($1, 'STF0066-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000',
            'IN_STOCK', $2, NOW(), $2)
         RETURNING id`,
        [SHOP_A, userAId],
      );
      return r.rows[0]!.id;
    }),
  );
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ---------------------------------------------------------------------------
// T3 — CHECK constraint blocks invalid style
// ---------------------------------------------------------------------------
describe('migration 0066: style CHECK constraint', () => {
  it('rejects style = UNKNOWN with CHECK violation (23514)', async () => {
    await expect(
      tenantContext.runWith(ctxA, () =>
        withTenantTx(pool, (tx) =>
          tx.query(`UPDATE products SET style = 'UNKNOWN' WHERE id = $1`, [productAId]),
        ),
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('accepts every valid style value without error', async () => {
    const validStyles = [
      'ENGAGEMENT','COUPLE','DAILY_WEAR','JHUMKA','STUDS','HOOPS',
      'DROP','STATEMENT','TEMPLE','BRIDAL','OFFICE','KIDS',
    ];
    for (const style of validStyles) {
      await expect(
        tenantContext.runWith(ctxA, () =>
          withTenantTx(pool, (tx) =>
            tx.query(`UPDATE products SET style = $1 WHERE id = $2`, [style, productAId]),
          ),
        ),
      ).resolves.not.toThrow();
    }
  });

  it('accepts NULL style (column is nullable)', async () => {
    await expect(
      tenantContext.runWith(ctxA, () =>
        withTenantTx(pool, (tx) =>
          tx.query(`UPDATE products SET style = NULL WHERE id = $1`, [productAId]),
        ),
      ),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Weight column invariant — must remain DECIMAL(12,4) after migration
// ---------------------------------------------------------------------------
describe('migration 0066: weight column types unchanged', () => {
  it('gross_weight_g and net_weight_g remain numeric(12,4)', async () => {
    const r = await pool.query<{
      column_name: string;
      data_type: string;
      numeric_precision: number;
      numeric_scale: number;
    }>(
      `SELECT column_name, data_type, numeric_precision, numeric_scale
         FROM information_schema.columns
        WHERE table_name = 'products'
          AND column_name IN ('gross_weight_g', 'net_weight_g')
        ORDER BY column_name`,
    );
    expect(r.rows).toHaveLength(2);
    for (const row of r.rows) {
      expect(row.data_type).toBe('numeric');
      expect(row.numeric_precision).toBe(12);
      expect(row.numeric_scale).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// T4 — GIN occasion index used by ANY(...)
// ---------------------------------------------------------------------------
describe('migration 0066: GIN occasion index', () => {
  it('planner uses products_occasion_gin_idx for ANY(occasion) filter', async () => {
    const client = await pool.connect();
    try {
      await client.query('SET enable_seqscan = off');
      const r = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT id FROM products WHERE 'WEDDING' = ANY(occasion)`,
      );
      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
      expect(plan).toContain('products_occasion_gin_idx');
    } finally {
      await client.query('RESET enable_seqscan');
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// T5 — composite top-sellers index used by ORDER BY expression
// ---------------------------------------------------------------------------
describe('migration 0066: top-sellers expression index', () => {
  it('planner uses products_top_sellers_idx for (sales*2+views) DESC ORDER BY', async () => {
    const client = await pool.connect();
    try {
      await client.query('SET enable_seqscan = off');
      const r = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT id FROM products
          WHERE shop_id = $1 AND published_at IS NOT NULL
          ORDER BY (sales_count_30d * 2 + view_count_30d) DESC, published_at DESC`,
        [SHOP_A],
      );
      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
      expect(plan).toContain('products_top_sellers_idx');
    } finally {
      await client.query('RESET enable_seqscan');
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// T6 — pg_trgm GIN index used by similarity search
// ---------------------------------------------------------------------------
describe('migration 0066: pg_trgm similarity index', () => {
  it('planner uses products_search_trgm_idx for expression % similarity query', async () => {
    const client = await pool.connect();
    try {
      await client.query('SET enable_seqscan = off');
      // The index expression is: coalesce(sku,'') || ' ' || coalesce(metal,'') || ' ' || coalesce(purity,'')
      // Query must match the exact expression to use the index.
      const r = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT id FROM products
          WHERE (coalesce(sku, '') || ' ' || coalesce(metal, '') || ' ' || coalesce(purity, '')) % 'AB-1042'
            AND published_at IS NOT NULL`,
      );
      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
      expect(plan).toContain('products_search_trgm_idx');
    } finally {
      await client.query('RESET enable_seqscan');
      client.release();
    }
  });
});
```

- [ ] **Step 2: Run the tests to confirm Red failure**

```bash
cd apps/api && pnpm vitest run test/storefront-schema-0066.integration.spec.ts
```

Expected: **ALL tests fail**. The failure message for T3 will be `column "style" does not exist` (Postgres 42703), not the CHECK violation. That is correct Red behaviour — the column doesn't exist yet.

Do NOT proceed to Task 2 unless you see test failures. If tests somehow pass, something is wrong — stop and investigate.

---

## Task 2 — [WS-A] Write migration 0066

**Files:**
- Create: `packages/db/src/migrations/0066_products_storefront_columns.sql`

**Critical constraints:**
- Do NOT touch `gross_weight_g` or `net_weight_g` column definitions.
- Do NOT create any file named `0067_*` on this branch — that number is reserved for `gs-stf-2`.
- `CREATE EXTENSION IF NOT EXISTS pg_trgm` must precede the trigram index.
- Wrap in `BEGIN; ... COMMIT;` (DDL-only, no DML per `docs/db-workflow.md`).

- [ ] **Step 1: Create the migration file**

```sql
-- packages/db/src/migrations/0066_products_storefront_columns.sql
-- Story A1 — Storefront-specific columns on products for customer catalog.
-- No backfill: all new columns have safe NULL / empty-array / 0 defaults.
-- Rollback: see rollback DDL at bottom (comment block).

BEGIN;

-- pg_trgm required before trigram GIN index. Idempotent.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE products
  ADD COLUMN style                   TEXT
    CONSTRAINT products_style_check CHECK (style IN (
      'ENGAGEMENT','COUPLE','DAILY_WEAR','JHUMKA','STUDS','HOOPS',
      'DROP','STATEMENT','TEMPLE','BRIDAL','OFFICE','KIDS'
    )),
  ADD COLUMN occasion                TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN gift_persona            TEXT[]   NOT NULL DEFAULT '{}',
  ADD COLUMN featured_score          SMALLINT NOT NULL DEFAULT 0
    CONSTRAINT products_featured_score_check CHECK (featured_score BETWEEN 0 AND 100),
  ADD COLUMN sales_count_30d         INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN view_count_30d          INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN price_snapshot_paise    BIGINT,
  ADD COLUMN price_snapshot_at       TIMESTAMPTZ,
  ADD COLUMN published_search_idx_at TIMESTAMPTZ;

-- Style: partial BTree — used by /products?style=JHUMKA filter.
CREATE INDEX products_style_idx
  ON products (shop_id, style)
  WHERE published_at IS NOT NULL;

-- Occasion + gift_persona: GIN — used by ANY(occasion) / ANY(gift_persona) filters.
CREATE INDEX products_occasion_gin_idx
  ON products USING GIN (occasion);

CREATE INDEX products_gift_persona_gin_idx
  ON products USING GIN (gift_persona);

-- Featured: partial BTree — used by /catalog/products/featured endpoint.
CREATE INDEX products_featured_idx
  ON products (shop_id, featured_score DESC)
  WHERE published_at IS NOT NULL AND featured_score > 0;

-- Price snapshot: partial BTree — used by priceMin/priceMax filter.
CREATE INDEX products_price_snapshot_idx
  ON products (shop_id, price_snapshot_paise)
  WHERE price_snapshot_paise IS NOT NULL AND published_at IS NOT NULL;

-- Top-sellers: expression BTree — ORDER BY (sales_count_30d * 2 + view_count_30d) DESC.
CREATE INDEX products_top_sellers_idx
  ON products (shop_id, (sales_count_30d * 2 + view_count_30d) DESC, published_at DESC)
  WHERE published_at IS NOT NULL;

-- Trigram search: GIN gin_trgm_ops — WHERE (...concatenation...) % 'query'.
CREATE INDEX products_search_trgm_idx
  ON products USING GIN (
    (coalesce(sku, '') || ' ' || coalesce(metal, '') || ' ' || coalesce(purity, ''))
    gin_trgm_ops
  )
  WHERE published_at IS NOT NULL;

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback DDL (run on a scratch DB to validate before claiming Task 3 done)
-- ---------------------------------------------------------------------------
-- DROP INDEX IF EXISTS products_style_idx;
-- DROP INDEX IF EXISTS products_occasion_gin_idx;
-- DROP INDEX IF EXISTS products_gift_persona_gin_idx;
-- DROP INDEX IF EXISTS products_featured_idx;
-- DROP INDEX IF EXISTS products_price_snapshot_idx;
-- DROP INDEX IF EXISTS products_top_sellers_idx;
-- DROP INDEX IF EXISTS products_search_trgm_idx;
-- ALTER TABLE products
--   DROP COLUMN IF EXISTS style,
--   DROP COLUMN IF EXISTS occasion,
--   DROP COLUMN IF EXISTS gift_persona,
--   DROP COLUMN IF EXISTS featured_score,
--   DROP COLUMN IF EXISTS sales_count_30d,
--   DROP COLUMN IF EXISTS view_count_30d,
--   DROP COLUMN IF EXISTS price_snapshot_paise,
--   DROP COLUMN IF EXISTS price_snapshot_at,
--   DROP COLUMN IF EXISTS published_search_idx_at;
-- (pg_trgm extension is NOT dropped — may be used by other indexes.)
```

- [ ] **Step 2: Verify rollback DDL is valid on a scratch DB**

```bash
# Option A: apply full migrations to a local dev Postgres, then run rollback
psql $DATABASE_URL -f packages/db/src/migrations/0066_products_storefront_columns.sql
# Extract and run only the rollback block (lines 43–56 of the file):
psql $DATABASE_URL <<'SQL'
DROP INDEX IF EXISTS products_style_idx;
DROP INDEX IF EXISTS products_occasion_gin_idx;
DROP INDEX IF EXISTS products_gift_persona_gin_idx;
DROP INDEX IF EXISTS products_featured_idx;
DROP INDEX IF EXISTS products_price_snapshot_idx;
DROP INDEX IF EXISTS products_top_sellers_idx;
DROP INDEX IF EXISTS products_search_trgm_idx;
ALTER TABLE products
  DROP COLUMN IF EXISTS style,
  DROP COLUMN IF EXISTS occasion,
  DROP COLUMN IF EXISTS gift_persona,
  DROP COLUMN IF EXISTS featured_score,
  DROP COLUMN IF EXISTS sales_count_30d,
  DROP COLUMN IF EXISTS view_count_30d,
  DROP COLUMN IF EXISTS price_snapshot_paise,
  DROP COLUMN IF EXISTS price_snapshot_at,
  DROP COLUMN IF EXISTS published_search_idx_at;
SQL
```

Expected: no errors. If local Postgres is unavailable, skip this step and note it in the commit message — the integration tests exercise the migration forward path, which is the higher-risk direction.

---

## Task 3 — [WS-E Green] Run 0066 tests + commit

**Files:**
- No new files — migration now present; test expectations should be met.

- [ ] **Step 1: Run the 0066 test suite**

```bash
cd apps/api && pnpm vitest run test/storefront-schema-0066.integration.spec.ts
```

Expected output (all 9 tests pass):
```
✓ migration 0066: style CHECK constraint > rejects style = UNKNOWN with CHECK violation (23514)
✓ migration 0066: style CHECK constraint > accepts every valid style value without error
✓ migration 0066: style CHECK constraint > accepts NULL style (column is nullable)
✓ migration 0066: weight column types unchanged > gross_weight_g and net_weight_g remain numeric(12,4)
✓ migration 0066: GIN occasion index > planner uses products_occasion_gin_idx for ANY(occasion) filter
✓ migration 0066: top-sellers expression index > planner uses products_top_sellers_idx for (sales*2+views) DESC ORDER BY
✓ migration 0066: pg_trgm similarity index > planner uses products_search_trgm_idx for expression % similarity query
Test Files  1 passed (1)
Tests       7 passed (7)
```

If any test fails, diagnose and fix the migration SQL before committing. Common causes:
- Expression index text must exactly match the query expression (including `coalesce` case and spacing)
- `enable_seqscan = off` must be set on the SAME connection as the EXPLAIN query
- Partial index predicates must match the WHERE clause in the query

- [ ] **Step 2: Commit**

```bash
git add \
  packages/db/src/migrations/0066_products_storefront_columns.sql \
  apps/api/test/storefront-schema-0066.integration.spec.ts
git commit -m "$(cat <<'EOF'
feat(db): add products storefront columns + indexes (migration 0066, story A1)

Nine new columns: style (CHECK constraint), occasion[], gift_persona[],
featured_score, sales_count_30d, view_count_30d, price_snapshot_paise,
price_snapshot_at, published_search_idx_at. Seven indexes including two GIN
arrays, pg_trgm expression, and expression top-sellers index. All 7 spec
tests (T3-T6 + weight invariant) passing.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — [WS-C+D Red] Write failing 0068 trigger + cross-tenant FK tests

**Files:**
- Create: `apps/api/test/storefront-schema-0068.integration.spec.ts`

**Context:** Until `0068_*.sql` exists, `products` has no `primary_image_id` column. Tests will fail with `column "primary_image_id" does not exist`. That is the Red failure.

- [ ] **Step 1: Create the test file**

```typescript
// apps/api/test/storefront-schema-0068.integration.spec.ts
//
// Mandatory spec tests T1 (FK cross-tenant) and T2 (trigger SECURITY INVOKER).
// UUID prefix dd5xxxxx / ee5xxxxx — non-overlapping with other test files.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

// ---------------------------------------------------------------------------
// Fixture UUIDs — non-overlapping with other integration test files
// ---------------------------------------------------------------------------
const SHOP_A = 'dd500001-dd00-4000-dd00-000000000001';
const SHOP_B = 'ee500002-ee00-4000-ee00-000000000002';

const tenantA: Tenant = { id: SHOP_A, slug: 'stf-0068-a', display_name: '0068 Shop A', status: 'ACTIVE' };
const tenantB: Tenant = { id: SHOP_B, slug: 'stf-0068-b', display_name: '0068 Shop B', status: 'ACTIVE' };
const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
const ctxB: UnauthenticatedTenantContext = { shopId: SHOP_B, tenant: tenantB, authenticated: false };

let container: StartedPostgreSqlContainer;
let pool: Pool;
let userAId: string;
let userBId: string;
let productAId: string;
let productBId: string;

// Inserts a product_images row in the given tenant context.
const insertImage = (
  shopId: string,
  ctx: UnauthenticatedTenantContext,
  productId: string,
  uploaderId: string,
  opts: { sortOrder?: number; scanStatus?: string } = {},
) =>
  tenantContext.runWith(ctx, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO product_images
           (shop_id, product_id, storage_key, mime_type, byte_size, width, height,
            exif_stripped_at, uploaded_by_user_id, scan_status, sort_order)
         VALUES
           ($1, $2, $3, 'image/jpeg', 1234, 800, 600,
            NOW(), $4, $5, $6)
         RETURNING id`,
        [
          shopId,
          productId,
          `tenant/${shopId}/products/${productId}/${Math.random().toString(36).slice(2)}.jpg`,
          uploaderId,
          opts.scanStatus ?? 'clean',
          opts.sortOrder ?? 0,
        ],
      );
      return r.rows[0]!.id;
    }),
  );

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed shops via raw connection
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES
        ($1, 'stf-0068-a', '0068 Shop A', 'ACTIVE'),
        ($2, 'stf-0068-b', '0068 Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
  } finally {
    c.release();
  }

  // Seed users
  userAId = await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
           VALUES ($1, '+919500000101', 'Owner 0068A', 'shop_admin', 'ACTIVE') RETURNING id`,
        [SHOP_A],
      );
      return r.rows[0]!.id;
    }),
  );

  userBId = await tenantContext.runWith(ctxB, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
           VALUES ($1, '+919500000102', 'Owner 0068B', 'shop_admin', 'ACTIVE') RETURNING id`,
        [SHOP_B],
      );
      return r.rows[0]!.id;
    }),
  );

  // Seed products
  productAId = await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
            stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'STF0068-A-001', 'GOLD', '22K', '10.0000', '9.0000',
                 '0.0000', 'IN_STOCK', $2)
         RETURNING id`,
        [SHOP_A, userAId],
      );
      return r.rows[0]!.id;
    }),
  );

  productBId = await tenantContext.runWith(ctxB, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
            stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'STF0068-B-001', 'GOLD', '22K', '10.0000', '9.0000',
                 '0.0000', 'IN_STOCK', $2)
         RETURNING id`,
        [SHOP_B, userBId],
      );
      return r.rows[0]!.id;
    }),
  );
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ---------------------------------------------------------------------------
// Backfill verification — after migration, existing clean images populate primary_image_id
// (The beforeAll seeds products THEN runMigrations already ran; backfill applies during
// migration so products created BEFORE migration would be backfilled. In this test the
// products are seeded AFTER migration, so backfill doesn't apply here. Test trigger instead.)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// T1 — primary_image_id FK does not bypass RLS via cross-tenant image
// ---------------------------------------------------------------------------
describe('migration 0068: composite FK cross-tenant guard', () => {
  it('rejects setting primary_image_id to a cross-tenant image (FK violation 23503)', async () => {
    // Insert a valid image in Shop B for Shop B's product.
    const imageBId = await insertImage(SHOP_B, ctxB, productBId, userBId);

    // Attempt to point Shop A's product at Shop B's image.
    // Composite FK (shop_id, primary_image_id) → product_images(shop_id, id) requires
    // that (SHOP_A, imageBId) exists in product_images — it does not → 23503.
    await expect(
      tenantContext.runWith(ctxA, () =>
        withTenantTx(pool, (tx) =>
          tx.query(
            `UPDATE products SET primary_image_id = $1 WHERE id = $2`,
            [imageBId, productAId],
          ),
        ),
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('allows same-tenant primary_image_id assignment (control)', async () => {
    // Insert a clean image in Shop A for Shop A's product.
    const imageAId = await insertImage(SHOP_A, ctxA, productAId, userAId);

    // Same-tenant assignment must succeed.
    await expect(
      tenantContext.runWith(ctxA, () =>
        withTenantTx(pool, (tx) =>
          tx.query(
            `UPDATE products SET primary_image_id = $1 WHERE id = $2`,
            [imageAId, productAId],
          ),
        ),
      ),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// T2 — maintain trigger respects RLS under SECURITY INVOKER
// ---------------------------------------------------------------------------
describe('migration 0068: maintain trigger (SECURITY INVOKER)', () => {
  it('trigger auto-sets primary_image_id on first clean image INSERT', async () => {
    // Products start with NULL primary_image_id; inserting a clean image should trigger recompute.
    const imageId = await insertImage(SHOP_A, ctxA, productAId, userAId, { sortOrder: 99 });

    // The trigger should have set products.primary_image_id to this image.
    // Use raw pool connection to bypass RLS for the assertion read.
    const r = await pool.query<{ primary_image_id: string | null }>(
      `SELECT primary_image_id FROM products WHERE id = $1`,
      [productAId],
    );
    // primary_image_id must be some image belonging to productA (the one with lowest sort_order)
    expect(r.rows[0]!.primary_image_id).toBeTruthy();
  });

  it('trigger NULLs primary_image_id when last clean image is deleted', async () => {
    // Insert exactly one clean image in a fresh product to have a controlled state.
    // Use a new product to avoid state from previous test.
    const freshProductId = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO products
             (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
              stone_weight_g, status, created_by_user_id)
           VALUES ($1, 'STF0068-A-002', 'GOLD', '22K', '10.0000', '9.0000',
                   '0.0000', 'IN_STOCK', $2)
           RETURNING id`,
          [SHOP_A, userAId],
        );
        return r.rows[0]!.id;
      }),
    );

    const onlyImageId = await insertImage(SHOP_A, ctxA, freshProductId, userAId, { sortOrder: 0 });

    // Verify trigger set primary_image_id
    const before = await pool.query<{ primary_image_id: string | null }>(
      `SELECT primary_image_id FROM products WHERE id = $1`,
      [freshProductId],
    );
    expect(before.rows[0]!.primary_image_id).toBe(onlyImageId);

    // Delete the only clean image as Shop A user
    await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, (tx) =>
        tx.query(`DELETE FROM product_images WHERE id = $1`, [onlyImageId]),
      ),
    );

    // Trigger must have NULLed primary_image_id (no more clean images)
    const after = await pool.query<{ primary_image_id: string | null }>(
      `SELECT primary_image_id FROM products WHERE id = $1`,
      [freshProductId],
    );
    expect(after.rows[0]!.primary_image_id).toBeNull();
  });

  it('trigger does not affect other tenant products (RLS under SECURITY INVOKER)', async () => {
    // Record Shop B product primary_image_id before any Shop A operation
    const beforeB = await pool.query<{ primary_image_id: string | null }>(
      `SELECT primary_image_id FROM products WHERE id = $1`,
      [productBId],
    );
    const bPrimaryBefore = beforeB.rows[0]!.primary_image_id;

    // Insert a new image in Shop A (triggers recompute for Shop A's product only)
    await insertImage(SHOP_A, ctxA, productAId, userAId, { sortOrder: 0 });

    // Shop B's product primary_image_id must be unchanged
    const afterB = await pool.query<{ primary_image_id: string | null }>(
      `SELECT primary_image_id FROM products WHERE id = $1`,
      [productBId],
    );
    expect(afterB.rows[0]!.primary_image_id).toBe(bPrimaryBefore);
  });
});
```

- [ ] **Step 2: Run the tests to confirm Red failure**

```bash
cd apps/api && pnpm vitest run test/storefront-schema-0068.integration.spec.ts
```

Expected: **ALL tests fail** with `column "primary_image_id" does not exist` (42703). That is the correct Red state.

---

## Task 5 — [WS-B] Write migration 0068

**Files:**
- Create: `packages/db/src/migrations/0068_products_primary_image.sql`

**Critical constraints:**
- `product_images_shop_id_id_uniq` UNIQUE must be added BEFORE the composite FK (FK target requires unique constraint).
- Trigger MUST be `SECURITY INVOKER` — `SECURITY DEFINER` bypasses RLS and is banned.
- Composite FK ON DELETE SET NULL: when an image is deleted, FK sets `primary_image_id = NULL` before the trigger fires (trigger then recomputes from remaining clean images, restoring to the next best image or NULL if none remain).
- Do NOT create `0067_*` on this branch.

- [ ] **Step 1: Create the migration file**

```sql
-- packages/db/src/migrations/0068_products_primary_image.sql
-- Story A3 — products.primary_image_id with composite FK (mirrors 0058 pattern)
-- and a SECURITY INVOKER trigger to auto-maintain the column.
--
-- Security rationale: a plain FK (primary_image_id → product_images.id) would allow
-- a Tenant-A product to reference a Tenant-B image — the RLS policy on products
-- filters rows but does NOT prevent FK references into other tenants' images.
-- Composite FK (shop_id, primary_image_id) → product_images(shop_id, id) closes this
-- at the schema layer, mirroring the 0058 pattern for product_images → products.

BEGIN;

-- Step 1: UNIQUE constraint on product_images(shop_id, id) as composite FK target.
-- product_images.id is already a PRIMARY KEY (unique), but FKs can only reference
-- UNIQUE or PRIMARY KEY constraints. Adding an explicit UNIQUE(shop_id, id) lets
-- the composite FK reference (shop_id, id) while the primary key covers (id) alone.
ALTER TABLE product_images
  ADD CONSTRAINT product_images_shop_id_id_uniq UNIQUE (shop_id, id);

-- Step 2: Add primary_image_id column (nullable — NULL = no clean image available).
ALTER TABLE products
  ADD COLUMN primary_image_id UUID;

-- Step 3: Composite FK — blocks cross-tenant image association at the schema layer.
-- ON DELETE SET NULL: when a product_image is deleted, Postgres first sets
-- primary_image_id = NULL (FK action), then the trigger fires AFTER DELETE and
-- recomputes primary_image_id from remaining clean images.
ALTER TABLE products
  ADD CONSTRAINT products_shop_primary_image_fkey
  FOREIGN KEY (shop_id, primary_image_id)
  REFERENCES product_images(shop_id, id)
  ON DELETE SET NULL;

-- Step 4: Backfill — set primary_image_id for products that already have clean images.
-- Products with no clean images remain NULL (correct and safe).
UPDATE products
   SET primary_image_id = (
     SELECT pi.id
       FROM product_images pi
      WHERE pi.product_id = products.id
        AND pi.scan_status = 'clean'
      ORDER BY pi.sort_order ASC, pi.created_at ASC
      LIMIT 1
   );

-- Step 5: Trigger function. SECURITY INVOKER so RLS stays active during trigger
-- execution — the trigger UPDATE runs under the session user's privileges, not
-- a privileged role, preventing cross-tenant writes.
CREATE OR REPLACE FUNCTION maintain_products_primary_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- COALESCE handles both DELETE (NEW is null) and INSERT/UPDATE (OLD may be null).
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE products
     SET primary_image_id = (
       SELECT pi.id
         FROM product_images pi
        WHERE pi.product_id = v_product_id
          AND pi.scan_status = 'clean'
        ORDER BY pi.sort_order ASC, pi.created_at ASC
        LIMIT 1
     )
   WHERE id = v_product_id;

  -- AFTER trigger return value is ignored by Postgres; RETURN NEW is conventional.
  RETURN NEW;
END;
$$;

-- Fires after any of the four mutation events that can change which image is "primary":
--   INSERT      — new image added; may become primary if it has the lowest sort_order
--   DELETE      — image removed; FK ON DELETE SET NULL fires first, then trigger recomputes
--   UPDATE OF sort_order  — reorder can change which image is first
--   UPDATE OF scan_status — an image becoming 'clean' or 'rejected' changes eligibility
CREATE TRIGGER trg_maintain_products_primary_image
AFTER INSERT OR DELETE OR UPDATE OF sort_order, scan_status
ON product_images
FOR EACH ROW
EXECUTE FUNCTION maintain_products_primary_image();

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback DDL (validate on scratch DB before claiming Task 6 done)
-- ---------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trg_maintain_products_primary_image ON product_images;
-- DROP FUNCTION IF EXISTS maintain_products_primary_image();
-- ALTER TABLE products
--   DROP CONSTRAINT IF EXISTS products_shop_primary_image_fkey,
--   DROP COLUMN IF EXISTS primary_image_id;
-- ALTER TABLE product_images
--   DROP CONSTRAINT IF EXISTS product_images_shop_id_id_uniq;
```

- [ ] **Step 2: Validate rollback DDL on a scratch DB**

```bash
# Apply 0068 forward first (0066 must already be applied):
psql $DATABASE_URL -f packages/db/src/migrations/0068_products_primary_image.sql
# Run rollback block:
psql $DATABASE_URL <<'SQL'
DROP TRIGGER IF EXISTS trg_maintain_products_primary_image ON product_images;
DROP FUNCTION IF EXISTS maintain_products_primary_image();
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_shop_primary_image_fkey,
  DROP COLUMN IF EXISTS primary_image_id;
ALTER TABLE product_images
  DROP CONSTRAINT IF EXISTS product_images_shop_id_id_uniq;
SQL
```

Expected: no errors. If local Postgres is unavailable, the integration tests in Task 6 serve as the runtime verification — note in commit message.

---

## Task 6 — [WS-C+D Green] Run 0068 tests + commit

**Files:**
- No new files — migration now present; test expectations should be met.

- [ ] **Step 1: Run the 0068 test suite**

```bash
cd apps/api && pnpm vitest run test/storefront-schema-0068.integration.spec.ts
```

Expected output (all 5 tests pass):
```
✓ migration 0068: composite FK cross-tenant guard > rejects setting primary_image_id to a cross-tenant image (FK violation 23503)
✓ migration 0068: composite FK cross-tenant guard > allows same-tenant primary_image_id assignment (control)
✓ migration 0068: maintain trigger (SECURITY INVOKER) > trigger auto-sets primary_image_id on first clean image INSERT
✓ migration 0068: maintain trigger (SECURITY INVOKER) > trigger NULLs primary_image_id when last clean image is deleted
✓ migration 0068: maintain trigger (SECURITY INVOKER) > trigger does not affect other tenant products (RLS under SECURITY INVOKER)
Test Files  1 passed (1)
Tests       5 passed (5)
```

If T1 (23503 test) fails with "resolved" instead of "rejected":
- The `product_images_shop_id_id_uniq` constraint may be missing — verify `\d product_images` shows it.
- The FK constraint `products_shop_primary_image_fkey` may reference the wrong columns.

If T2 trigger tests fail with "primary_image_id is null" after INSERT:
- Verify the trigger fires AFTER INSERT (not BEFORE).
- Verify the trigger function computes correctly: `WHERE pi.product_id = v_product_id AND pi.scan_status = 'clean'`.

- [ ] **Step 2: Run both integration test suites together**

```bash
cd apps/api && pnpm vitest run test/storefront-schema-0066.integration.spec.ts test/storefront-schema-0068.integration.spec.ts
```

Expected: 12 tests total pass across both files.

- [ ] **Step 3: Commit**

```bash
git add \
  packages/db/src/migrations/0068_products_primary_image.sql \
  apps/api/test/storefront-schema-0068.integration.spec.ts
git commit -m "$(cat <<'EOF'
feat(db): add primary_image_id composite FK + SECURITY INVOKER trigger (migration 0068, story A3)

Composite FK (shop_id, primary_image_id) → product_images(shop_id, id) closes
cross-tenant image association loophole at schema layer, mirroring 0058 pattern.
SECURITY INVOKER trigger auto-maintains primary_image_id on INSERT/DELETE/sort_order/
scan_status changes. Backfill sets existing products from first clean image. All 5
spec tests (T1 FK cross-tenant, T2 trigger RLS) passing.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — [WS-F] Update Drizzle schema

**Files:**
- Modify: `packages/db/src/schema/products.ts`

**Context:** The Drizzle schema is used by Phase B `catalog.service.ts` queries. It must match the DDL or TypeScript types will be wrong. `smallint` IS exported from `drizzle-orm/pg-core` (confirmed from `pg-core/columns/smallint.d.ts`). For text array defaults, use the JS `[]` literal — Drizzle 0.30 serialises it to `'{}'::text[]` in generated DDL. `sql` template tag is NOT needed for the array default.

- [ ] **Step 1: Update `packages/db/src/schema/products.ts`**

Replace the file completely with:

```typescript
import { uuid, text, timestamp, decimal, integer, smallint, bigint, pgEnum } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';
import { productCategories } from './product-categories';

export const huidExemptionCategoryEnum = pgEnum('huid_exemption_category', [
  'none',
  'kundan_polki_jadau',
  'under_2g',
]);

export const CATALOG_STYLES = [
  'ENGAGEMENT', 'COUPLE', 'DAILY_WEAR', 'JHUMKA', 'STUDS', 'HOOPS',
  'DROP', 'STATEMENT', 'TEMPLE', 'BRIDAL', 'OFFICE', 'KIDS',
] as const;
export type CatalogStyle = typeof CATALOG_STYLES[number];

export const products = tenantScopedTable('products', {
  id:                         uuid('id').primaryKey().defaultRandom(),
  category_id:                uuid('category_id').references(() => productCategories.id),
  sku:                        text('sku').notNull(),
  metal:                      text('metal').notNull(),
  purity:                     text('purity').notNull(),
  gross_weight_g:             decimal('gross_weight_g', { precision: 12, scale: 4 }).notNull(),
  net_weight_g:               decimal('net_weight_g',   { precision: 12, scale: 4 }).notNull(),
  stone_weight_g:             decimal('stone_weight_g', { precision: 12, scale: 4 }).default('0.0000').notNull(),
  stone_details:              text('stone_details'),
  making_charge_override_pct: decimal('making_charge_override_pct', { precision: 5, scale: 2 }),
  huid:                       text('huid'),
  huid_exemption_category:    huidExemptionCategoryEnum('huid_exemption_category').notNull().default('none'),
  status:                     text('status').notNull().default('IN_STOCK'),
  quantity:                   integer('quantity').notNull().default(1),
  published_at:               timestamp('published_at', { withTimezone: true }),
  published_by_user_id:       uuid('published_by_user_id'),
  created_by_user_id:         uuid('created_by_user_id').notNull(),
  created_at:                 timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:                 timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // -------------------------------------------------------------------------
  // Storefront columns — added in migration 0066 (Story A1)
  // -------------------------------------------------------------------------
  style:                      text('style'),
  occasion:                   text('occasion').array().notNull().default([]),
  gift_persona:               text('gift_persona').array().notNull().default([]),
  featured_score:             smallint('featured_score').notNull().default(0),
  sales_count_30d:            integer('sales_count_30d').notNull().default(0),
  view_count_30d:             integer('view_count_30d').notNull().default(0),
  price_snapshot_paise:       bigint('price_snapshot_paise', { mode: 'bigint' }),
  price_snapshot_at:          timestamp('price_snapshot_at', { withTimezone: true }),
  published_search_idx_at:    timestamp('published_search_idx_at', { withTimezone: true }),
  // -------------------------------------------------------------------------
  // Primary image reference — added in migration 0068 (Story A3)
  // Composite FK enforced at DDL layer (see migration 0068).
  // Drizzle does not model composite FKs natively; constraint lives in SQL.
  // -------------------------------------------------------------------------
  primary_image_id:           uuid('primary_image_id'),
});
```

- [ ] **Step 2: Build the db package**

```bash
pnpm --filter @goldsmith/db build
```

Expected: no errors. Exit code 0.

- [ ] **Step 3: Typecheck the API**

Because typecheck reads from the pre-built package declarations, rebuild the full graph first:

```bash
pnpm turbo build --filter="@goldsmith/*"
pnpm --filter @goldsmith/api typecheck
```

Expected: no errors from `packages/db/src/schema/products.ts`. If you see errors about `smallint` not being a valid import, verify the import line matches exactly what's in Task 7 Step 1 — it must include `smallint` in the destructure from `'drizzle-orm/pg-core'`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/products.ts
git commit -m "$(cat <<'EOF'
feat(db): update products Drizzle schema for storefront columns + primary_image_id

Adds CATALOG_STYLES const + CatalogStyle type export for use in Phase B catalog
service. Adds 10 new column definitions matching 0066+0068 DDL: style (text),
occasion/gift_persona (text array), featured_score (smallint), sales_count_30d/
view_count_30d (integer), price_snapshot_paise (bigint), timestamp fields,
primary_image_id (uuid).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 — Code-truth audit + full test run

**Files:** None — verification only.

- [ ] **Step 1: git grep for all 6 new column names across migration + schema + tests**

Each command must return at least one hit. If any returns empty, the column is missing from that artifact.

```bash
# From C:\gs-stf-1 root
git grep "style" packages/db/src/migrations/0066_products_storefront_columns.sql packages/db/src/schema/products.ts apps/api/test/storefront-schema-0066.integration.spec.ts
git grep "occasion" packages/db/src/migrations/0066_products_storefront_columns.sql packages/db/src/schema/products.ts apps/api/test/storefront-schema-0066.integration.spec.ts
git grep "gift_persona" packages/db/src/migrations/0066_products_storefront_columns.sql packages/db/src/schema/products.ts apps/api/test/storefront-schema-0066.integration.spec.ts
git grep "price_snapshot_paise" packages/db/src/migrations/0066_products_storefront_columns.sql packages/db/src/schema/products.ts apps/api/test/storefront-schema-0066.integration.spec.ts
git grep "primary_image_id" packages/db/src/migrations/0068_products_primary_image.sql packages/db/src/schema/products.ts apps/api/test/storefront-schema-0068.integration.spec.ts
git grep "products_top_sellers_idx" packages/db/src/migrations/0066_products_storefront_columns.sql apps/api/test/storefront-schema-0066.integration.spec.ts
```

All six must produce hits. If any fails, fix the missing artifact before proceeding.

- [ ] **Step 2: Verify 0067_*.sql does NOT exist on this branch**

```bash
ls packages/db/src/migrations/0067* 2>&1
```

Expected: `ls: cannot access '...' No such file or directory`. If a file named `0067_*` exists, it must be deleted — that number belongs to `gs-stf-2`.

- [ ] **Step 3: Run full integration test suite**

```bash
cd apps/api && pnpm vitest run test/storefront-schema-0066.integration.spec.ts test/storefront-schema-0068.integration.spec.ts
```

Expected: 12 tests, all pass.

- [ ] **Step 4: Run the full API unit test suite**

```bash
cd apps/api && pnpm vitest run src/
```

Expected: same pass count as before (no regressions from schema change). The new columns are additive; no existing unit tests reference the new column names in mocks, so no mock updates needed.

---

## Task 9 — [WS-E Gate] Review gate + push

**Files:**
- Create: `.codex-review-passed` (after Codex passes)
- Create: `.security-review-passed` (after /security-review passes)

- [ ] **Step 1: Final pre-flight**

```bash
pnpm turbo build --filter="@goldsmith/*"
pnpm --filter @goldsmith/api typecheck
pnpm --filter @goldsmith/api lint
cd apps/api && pnpm vitest run
```

All must exit 0 before proceeding to review gates. Fix any issues before running Codex.

- [ ] **Step 2: Codex review (from main repo — CLM workaround)**

Per `memory/feedback_codex_worktree_clm.md`: Codex fails in Windows git worktrees due to PowerShell CLM. Run from the main repo path against this branch:

```bash
# In a terminal at C:\Alok\Business Projects\Goldsmith (NOT C:\gs-stf-1)
git fetch origin feat/storefront-schema-a1a3
codex review --base main origin/feat/storefront-schema-a1a3
```

If Codex CLI is truly unavailable this cycle (weekly limit), substitute:
1. Run `/security-review` in this session (required regardless)
2. Add note to commit message: `[Codex substituted: /security-review + Opus review chain]`

- [ ] **Step 3: Write `.codex-review-passed` marker**

```bash
echo "codex review passed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .codex-review-passed
git add .codex-review-passed
git commit -m "chore: write codex-review-passed marker for A1+A3"
```

- [ ] **Step 4: Run /security-review in parallel with Codex**

Invoke the `/security-review` skill in this session. It will check:
- No `SECURITY DEFINER` on the maintain trigger
- Composite FK closes cross-tenant loophole
- RLS not bypassed by new columns
- No float/real for any column

After it completes and passes:

```bash
echo "security review passed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .security-review-passed
git add .security-review-passed
git commit -m "chore: write security-review-passed marker for A1+A3"
```

- [ ] **Step 5: Runtime smoke — apply both migrations to local Postgres**

This is an API-only story (no Metro, no browser), so the runtime smoke is SQL-level:

```bash
# Requires a local Postgres instance (or Docker) at $DATABASE_URL
psql $DATABASE_URL -f packages/db/src/migrations/0066_products_storefront_columns.sql
psql $DATABASE_URL -f packages/db/src/migrations/0068_products_primary_image.sql

# Verify new columns exist
psql $DATABASE_URL -c "\d products" | grep -E "style|occasion|gift_persona|primary_image_id|featured_score|price_snapshot_paise"

# Verify weight columns unchanged
psql $DATABASE_URL -c "SELECT column_name, data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('gross_weight_g', 'net_weight_g')"

# Verify trigger exists
psql $DATABASE_URL -c "\df maintain_products_primary_image"

# Verify indexes exist
psql $DATABASE_URL -c "\di products_*"
```

Expected: 7 new indexes listed (`products_style_idx`, `products_occasion_gin_idx`, `products_gift_persona_gin_idx`, `products_featured_idx`, `products_price_snapshot_idx`, `products_top_sellers_idx`, `products_search_trgm_idx`). Function `maintain_products_primary_image` listed.

If local Postgres is unavailable, the Testcontainer test suite (Task 8 Step 3) is the runtime smoke — it applies migrations via `runMigrations` to a real Postgres 15.6 container. Mark smoke as complete if integration tests pass.

- [ ] **Step 6: Push**

```bash
git push -u origin feat/storefront-schema-a1a3
```

---

## Acceptance Criteria Traceability

| Spec test | Task | Test file + describe block |
|---|---|---|
| T1: FK does not bypass RLS | Task 4 (Red) → Task 5 (Green) | `storefront-schema-0068.integration.spec.ts` > `composite FK cross-tenant guard` |
| T2: trigger respects RLS (SECURITY INVOKER) | Task 4 (Red) → Task 5 (Green) | `storefront-schema-0068.integration.spec.ts` > `maintain trigger (SECURITY INVOKER)` |
| T3: CHECK blocks invalid style | Task 1 (Red) → Task 2 (Green) | `storefront-schema-0066.integration.spec.ts` > `style CHECK constraint` |
| T4: GIN occasion index | Task 1 (Red) → Task 2 (Green) | `storefront-schema-0066.integration.spec.ts` > `GIN occasion index` |
| T5: top-sellers index | Task 1 (Red) → Task 2 (Green) | `storefront-schema-0066.integration.spec.ts` > `top-sellers expression index` |
| T6: pg_trgm index | Task 1 (Red) → Task 2 (Green) | `storefront-schema-0066.integration.spec.ts` > `pg_trgm similarity index` |
| Weight invariant | Task 1 (Red) → Task 2 (Green) | `storefront-schema-0066.integration.spec.ts` > `weight column types unchanged` |

---

## Non-negotiable floor (verify before Task 9)

- [ ] `gross_weight_g` and `net_weight_g` remain `numeric(12,4)` — Task 8 Step 1 git grep + Task 8 Step 3 test asserts it
- [ ] Every new index starts with `shop_id` (prevents cross-tenant full-table scans)
- [ ] Trigger is `SECURITY INVOKER` — grep: `git grep "SECURITY DEFINER" packages/db/src/migrations/0068_*` must return empty
- [ ] Composite FK on `primary_image_id` — not a plain FK
- [ ] No file `packages/db/src/migrations/0067_*` on this branch
- [ ] `.codex-review-passed` and `.security-review-passed` both committed before push
