# Story A2 — Collections + collection_products Tables: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `collections` and `collection_products` tables with RLS, FORCE, composite FK cross-tenant guards, and Drizzle schema — migration 0067.

**Architecture:** Single SQL migration wraps all DDL in `BEGIN/COMMIT`. RLS `USING + WITH CHECK` on both tables. Composite `(shop_id, …)` FKs prevent cross-tenant references at the schema layer — a plain FK on `hero_image_id` alone would allow Shop A to point at Shop B's images; the composite form closes this. Drizzle schema is the TypeScript type layer only; the SQL migration is authoritative for constraints.

**Tech Stack:** PostgreSQL 15, Drizzle ORM, Vitest + @testcontainers/postgresql (integration tests), `@goldsmith/db` (`runMigrations`, `withTenantTx`, `createPool`), `@goldsmith/tenant-context`.

---

## Files

| Action | Path | Purpose |
|--------|------|---------|
| **Create** | `packages/db/src/migrations/0067_collections.sql` | DDL: pre-condition UNIQUE on product_images, collections table, collection_products join table, RLS, grants, indexes |
| **Create** | `packages/db/src/schema/collections.ts` | Drizzle type layer for both tables |
| **Modify** | `packages/db/src/schema/index.ts` | Export new schema file |
| **Create** | `apps/api/test/collections-tenant-isolation.integration.test.ts` | 8 integration tests covering all spec assertions (WS-C, D, E) |

---

## Task 1: Write integration tests (Red phase — WS-C, D, E)

**Files:**
- Create: `apps/api/test/collections-tenant-isolation.integration.test.ts`

Pattern: follow `apps/api/test/product-images-tenant-fk.integration.test.ts`. Spin up `PostgreSqlContainer('postgres:15.6')`, run `runMigrations`, seed two shops, seed users/products/images, then assert the 8 invariants.

- [ ] **Step 1.1: Create the test file**

```typescript
// apps/api/test/collections-tenant-isolation.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

const SHOP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SHOP_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let productAId: string;
let productBId: string;
let imageAId: string;  // owned by SHOP_A
let imageBId: string;  // owned by SHOP_B

const ctxFor = (shopId: string): UnauthenticatedTenantContext => {
  const tenant: Tenant = { id: shopId, slug: `shop-${shopId.slice(0, 4)}`, display_name: 'Shop', status: 'ACTIVE' };
  return { shopId, tenant, authenticated: false };
};

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES
        ($1, 'shop-a', 'Shop A', 'ACTIVE'),
        ($2, 'shop-b', 'Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
  } finally { c.release(); }

  const seedUser = async (shopId: string, phone: string) =>
    tenantContext.runWith(ctxFor(shopId), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
           VALUES ($1, $2, 'Owner', 'shop_admin', 'ACTIVE') RETURNING id`,
          [shopId, phone],
        );
        return r.rows[0]!.id;
      }),
    );

  const seedProduct = async (shopId: string, sku: string) =>
    tenantContext.runWith(ctxFor(shopId), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO products
             (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
           VALUES ($1, $2, 'GOLD', '22K', '10.0000', '9.0000', '0.0000', 'IN_STOCK', $1) RETURNING id`,
          [shopId, sku],
        );
        return r.rows[0]!.id;
      }),
    );

  const seedImage = async (shopId: string, productId: string, userId: string) =>
    tenantContext.runWith(ctxFor(shopId), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO product_images
             (shop_id, product_id, storage_key, mime_type, byte_size, width, height,
              exif_stripped_at, uploaded_by_user_id, scan_status, sort_order)
           VALUES ($1, $2, $3, 'image/jpeg', 1024, 800, 600, NOW(), $4, 'clean', 0) RETURNING id`,
          [shopId, productId, `tenant/${shopId}/hero/${Math.random().toString(36).slice(2)}.jpg`, userId],
        );
        return r.rows[0]!.id;
      }),
    );

  const userAId = await seedUser(SHOP_A, '+919000000001');
  const userBId = await seedUser(SHOP_B, '+919000000002');
  productAId  = await seedProduct(SHOP_A, 'RING-A-001');
  productBId  = await seedProduct(SHOP_B, 'RING-B-001');
  imageAId    = await seedImage(SHOP_A, productAId, userAId);
  imageBId    = await seedImage(SHOP_B, productBId, userBId);
}, 180_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

const insertCollection = (shopId: string, slug: string, heroImageId?: string | null) =>
  tenantContext.runWith(ctxFor(shopId), () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO collections (shop_id, slug, title_hi, hero_image_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [shopId, slug, 'कलेक्शन', heroImageId ?? null],
      );
      return r.rows[0]!.id;
    }),
  );

describe('migration 0067: collections + collection_products RLS + composite FK', () => {

  describe('WS-C: tenant-isolation via composite FK', () => {
    it('rejects hero_image_id belonging to a different shop — composite FK 23503', async () => {
      await expect(
        insertCollection(SHOP_A, 'hero-xshop-test', imageBId),
      ).rejects.toMatchObject({ code: '23503' });
    });

    it('accepts hero_image_id belonging to the same shop — composite FK satisfied', async () => {
      const id = await insertCollection(SHOP_A, 'hero-same-shop', imageAId);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('rejects cross-tenant product in collection_products — composite FK 23503', async () => {
      const colId = await insertCollection(SHOP_A, 'cp-xshop-test');
      await expect(
        tenantContext.runWith(ctxFor(SHOP_A), () =>
          withTenantTx(pool, (tx) =>
            tx.query(
              `INSERT INTO collection_products (shop_id, collection_id, product_id) VALUES ($1, $2, $3)`,
              [SHOP_A, colId, productBId],
            ),
          ),
        ),
      ).rejects.toMatchObject({ code: '23503' });
    });

    it('RLS blocks cross-tenant SELECT on collections', async () => {
      await insertCollection(SHOP_A, 'rls-vis-a');
      await insertCollection(SHOP_B, 'rls-vis-b');

      const rowsA = await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, async (tx) => {
          const r = await tx.query<{ shop_id: string }>(`SELECT shop_id FROM collections`);
          return r.rows;
        }),
      );
      expect(rowsA.every((r) => r.shop_id === SHOP_A)).toBe(true);

      const rowsB = await tenantContext.runWith(ctxFor(SHOP_B), () =>
        withTenantTx(pool, async (tx) => {
          const r = await tx.query<{ shop_id: string }>(`SELECT shop_id FROM collections`);
          return r.rows;
        }),
      );
      expect(rowsB.every((r) => r.shop_id === SHOP_B)).toBe(true);
    });
  });

  describe('WS-D: cascade behavior', () => {
    it('deleting a collection cascades join rows; products untouched', async () => {
      const colId = await insertCollection(SHOP_A, 'cascade-col');
      await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, (tx) =>
          tx.query(
            `INSERT INTO collection_products (shop_id, collection_id, product_id) VALUES ($1, $2, $3)`,
            [SHOP_A, colId, productAId],
          ),
        ),
      );
      await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, (tx) => tx.query(`DELETE FROM collections WHERE id = $1`, [colId])),
      );

      // Use raw superuser pool to verify without RLS interference.
      const c = await pool.connect();
      try {
        const jp = await c.query<{ count: string }>(
          `SELECT count(*)::int AS count FROM collection_products WHERE collection_id = $1`,
          [colId],
        );
        expect(Number(jp.rows[0]!.count)).toBe(0);

        const pr = await c.query<{ count: string }>(
          `SELECT count(*)::int AS count FROM products WHERE id = $1`,
          [productAId],
        );
        expect(Number(pr.rows[0]!.count)).toBe(1);
      } finally { c.release(); }
    });

    it('deleting a product cascades join rows; collection untouched', async () => {
      const tmpProdId = await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, async (tx) => {
          const r = await tx.query<{ id: string }>(
            `INSERT INTO products
               (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
             VALUES ($1, 'TMP-CASCADE-PROD', 'GOLD', '22K', '5.0000', '4.5000', '0.0000', 'IN_STOCK', $1)
             RETURNING id`,
            [SHOP_A],
          );
          return r.rows[0]!.id;
        }),
      );
      const tmpColId = await insertCollection(SHOP_A, 'cascade-prod');
      await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, (tx) =>
          tx.query(
            `INSERT INTO collection_products (shop_id, collection_id, product_id) VALUES ($1, $2, $3)`,
            [SHOP_A, tmpColId, tmpProdId],
          ),
        ),
      );
      await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, (tx) => tx.query(`DELETE FROM products WHERE id = $1`, [tmpProdId])),
      );

      const c = await pool.connect();
      try {
        const jr = await c.query<{ count: string }>(
          `SELECT count(*)::int AS count FROM collection_products WHERE product_id = $1`,
          [tmpProdId],
        );
        expect(Number(jr.rows[0]!.count)).toBe(0);

        const cr = await c.query<{ count: string }>(
          `SELECT count(*)::int AS count FROM collections WHERE id = $1`,
          [tmpColId],
        );
        expect(Number(cr.rows[0]!.count)).toBe(1);
      } finally { c.release(); }
    });
  });

  describe('WS-E: constraint enforcement', () => {
    it('unique (shop_id, slug): duplicate in same shop → 23505', async () => {
      await insertCollection(SHOP_A, 'dup-slug');
      await expect(insertCollection(SHOP_A, 'dup-slug')).rejects.toMatchObject({ code: '23505' });
    });

    it('unique (shop_id, slug): same slug in different shops → allowed', async () => {
      await insertCollection(SHOP_A, 'cross-shop-slug');
      const id = await insertCollection(SHOP_B, 'cross-shop-slug');
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('DB CHECK rejects invalid slug formats → 23514', async () => {
      for (const bad of ['bridal_2026', 'Bridal-2026', 'bridal-', '-bridal', 'bridal--edit', '']) {
        await expect(insertCollection(SHOP_A, bad)).rejects.toMatchObject({ code: '23514' });
      }
    });

    it('valid slug formats pass CHECK', async () => {
      const id1 = await insertCollection(SHOP_A, 'bridal-2026');
      expect(id1).toMatch(/^[0-9a-f-]{36}$/);
      const id2 = await insertCollection(SHOP_A, 'new');
      expect(id2).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
```

- [ ] **Step 1.2: Run to confirm Red state (relation 'collections' does not exist)**

```bash
pnpm --filter @goldsmith/api test -- --reporter=verbose collections-tenant-isolation
```

Expected: ALL tests FAIL. Error: `relation "collections" does not exist`. If they pass, something is wrong — stop and investigate.

- [ ] **Step 1.3: Commit the test file (Red commit)**

```bash
git add apps/api/test/collections-tenant-isolation.integration.test.ts
git commit -m "test(a2): add Red integration tests for collections RLS + composite FK (0067)"
```

---

## Task 2: Write migration 0067 (WS-A — Green phase)

**Files:**
- Create: `packages/db/src/migrations/0067_collections.sql`

**Pre-condition note:** Migration 0058 added `UNIQUE(shop_id, id)` to `products` and `shop_users` but NOT to `product_images`. Step 2.1 adds it to `product_images` so the composite FK from `collections.hero_image_id` can reference `product_images(shop_id, id)`.

- [ ] **Step 2.1: Create the migration file**

```sql
-- packages/db/src/migrations/0067_collections.sql
-- Story A2: storefront collections.
-- Composite (shop_id, …) FK pattern from migration 0058 — plain FKs allow
-- cross-tenant references at the DB layer; composite FKs prevent that.

BEGIN;

-- ============================================================================
-- Pre-condition: product_images needs UNIQUE(shop_id, id) to serve as
-- composite FK target for collections.hero_image_id.
-- Migration 0058 added this constraint to products + shop_users but missed
-- product_images. Pure metadata change — id is PK so the pair is trivially
-- unique; no row rewrite occurs.
-- ============================================================================
ALTER TABLE product_images
  ADD CONSTRAINT product_images_shop_id_id_uniq UNIQUE (shop_id, id);

-- ============================================================================
-- 1. collections
-- ============================================================================
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

  CONSTRAINT collections_shop_slug_uniq  UNIQUE (shop_id, slug),
  CONSTRAINT collections_shop_id_id_uniq UNIQUE (shop_id, id),

  -- Composite FK: prevents cross-tenant hero image assignment.
  -- Requires product_images.UNIQUE(shop_id, id) added above.
  CONSTRAINT collections_shop_image_fkey
    FOREIGN KEY (shop_id, hero_image_id)
    REFERENCES product_images (shop_id, id)
    ON DELETE SET NULL
);

-- Listing hot path: published collections ordered by sort_order.
CREATE INDEX collections_listing_idx
  ON collections (shop_id, sort_order)
  WHERE published_at IS NOT NULL;

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_collections_tenant_isolation ON collections;
CREATE POLICY rls_collections_tenant_isolation ON collections
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

REVOKE ALL ON collections FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON collections TO app_user;

-- ============================================================================
-- 2. collection_products (join table)
-- ============================================================================
CREATE TABLE collection_products (
  shop_id       UUID        NOT NULL,
  collection_id UUID        NOT NULL,
  product_id    UUID        NOT NULL,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (shop_id, collection_id, product_id),

  -- Composite FK: ensures collection_id belongs to the same shop as the join row.
  -- ON DELETE CASCADE: removing a collection purges its join rows.
  CONSTRAINT cp_shop_collection_fkey
    FOREIGN KEY (shop_id, collection_id)
    REFERENCES collections (shop_id, id)
    ON DELETE CASCADE,

  -- Composite FK: ensures product_id belongs to the same shop.
  -- ON DELETE CASCADE: removing a product purges its join rows.
  CONSTRAINT cp_shop_product_fkey
    FOREIGN KEY (shop_id, product_id)
    REFERENCES products (shop_id, id)
    ON DELETE CASCADE
);

-- Products-in-collection list (primary read path for storefront).
CREATE INDEX collection_products_list_idx
  ON collection_products (shop_id, collection_id, sort_order);

-- Reverse lookup: which collections contain a given product?
CREATE INDEX collection_products_product_idx
  ON collection_products (shop_id, product_id);

ALTER TABLE collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_products FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_collection_products_tenant_isolation ON collection_products;
CREATE POLICY rls_collection_products_tenant_isolation ON collection_products
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

REVOKE ALL ON collection_products FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON collection_products TO app_user;

COMMIT;
```

- [ ] **Step 2.2: Run tests to confirm Green state**

```bash
pnpm --filter @goldsmith/api test -- --reporter=verbose collections-tenant-isolation
```

Expected output — all 8 tests PASS:
```
✓ WS-C: rejects hero_image_id belonging to a different shop
✓ WS-C: accepts hero_image_id belonging to the same shop
✓ WS-C: rejects cross-tenant product in collection_products
✓ WS-C: RLS blocks cross-tenant SELECT on collections
✓ WS-D: deleting a collection cascades join rows; products untouched
✓ WS-D: deleting a product cascades join rows; collection untouched
✓ WS-E: unique (shop_id, slug): duplicate in same shop → 23505
✓ WS-E: unique (shop_id, slug): same slug in different shops → allowed
✓ WS-E: DB CHECK rejects invalid slug formats → 23514
✓ WS-E: valid slug formats pass CHECK
```

If any test fails:
- Error `23503` not thrown → composite FK not created correctly — check constraint names and UNIQUE pre-condition on `product_images`
- Error `23514` not thrown for slug check → CHECK constraint regex wrong — verify `'^[a-z0-9]+(-[a-z0-9]+)*$'`
- Error `23505` not thrown for dup slug → UNIQUE constraint missing — check `CONSTRAINT collections_shop_slug_uniq`
- RLS test sees cross-tenant rows → RLS not applied — verify `ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY`

- [ ] **Step 2.3: Commit the migration (Green commit)**

```bash
git add packages/db/src/migrations/0067_collections.sql
git commit -m "feat(a2): add migration 0067 — collections + collection_products with RLS + composite FK"
```

---

## Task 3: Write Drizzle schema (WS-B)

**Files:**
- Create: `packages/db/src/schema/collections.ts`
- Modify: `packages/db/src/schema/index.ts` (add export at end)

**Pattern:** Follows `packages/db/src/schema/product-images.ts`. `tenantScopedTable` auto-injects `shop_id`. Composite FKs, CHECK, and UNIQUE constraints are NOT expressible in Drizzle DSL — they live in the SQL migration and are authoritative. Drizzle is the TypeScript type layer only.

- [ ] **Step 3.1: Create `packages/db/src/schema/collections.ts`**

```typescript
// packages/db/src/schema/collections.ts
import { uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { tenantScopedTable } from './_helpers/tenantScopedTable';

export const collections = tenantScopedTable('collections', {
  id:            uuid('id').primaryKey().defaultRandom(),
  slug:          text('slug').notNull(),
  title_hi:      text('title_hi').notNull(),
  title_en:      text('title_en'),
  subtitle_hi:   text('subtitle_hi'),
  // Nullable; composite FK (shop_id, hero_image_id) → product_images enforced in 0067 SQL.
  hero_image_id: uuid('hero_image_id'),
  sort_order:    integer('sort_order').notNull().default(0),
  is_premium:    boolean('is_premium').notNull().default(false),
  published_at:  timestamp('published_at', { withTimezone: true }),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Composite PK (shop_id, collection_id, product_id) defined in SQL migration 0067.
// Drizzle does not emit DDL for this table — the SQL migration is authoritative.
export const collectionProducts = tenantScopedTable('collection_products', {
  collection_id: uuid('collection_id').notNull(),
  product_id:    uuid('product_id').notNull(),
  sort_order:    integer('sort_order').notNull().default(0),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3.2: Add export to `packages/db/src/schema/index.ts`**

Open `packages/db/src/schema/index.ts`. Append at the end:

```typescript
export * from './collections';
```

The file currently ends with `export * from './custom-orders';`. Add the new line after it.

- [ ] **Step 3.3: Build the `@goldsmith/db` package**

```bash
pnpm --filter @goldsmith/db build
```

Expected: `tsc -p tsconfig.build.json` exits 0 with no errors. If type errors appear, check that all imported types (`uuid`, `text`, `integer`, `boolean`, `timestamp`) match the Drizzle version in use (`drizzle-orm/pg-core`).

- [ ] **Step 3.4: Verify the exports resolve via typecheck**

```bash
pnpm --filter @goldsmith/db typecheck 2>&1 | tail -5
```

Expected: exits 0 with no errors. This confirms the new `collections.ts` exports compile cleanly.

- [ ] **Step 3.5: Commit**

```bash
git add packages/db/src/schema/collections.ts packages/db/src/schema/index.ts
git commit -m "feat(a2): add Drizzle schema for collections + collectionProducts"
```

---

## Task 4: Full verification and final commit

- [ ] **Step 4.1: Run full API typecheck**

```bash
pnpm --filter @goldsmith/api typecheck
```

Expected: exits 0 (only the pre-existing node v24 engine warning is acceptable).

- [ ] **Step 4.2: Run full API test suite**

```bash
pnpm --filter @goldsmith/api test 2>&1 | tail -20
```

Expected: total test count increases by 10 (the 10 new assertions). No pre-existing tests regress. Overall exit code 0.

- [ ] **Step 4.3: Run schema RLS invariant test to confirm new tables register correctly**

```bash
pnpm --filter @goldsmith/api test -- --reporter=verbose schema-assertions
```

Expected: `assertRlsInvariants passes against freshly migrated schema` → PASS. This test reads `tableRegistry` (populated by `tenantScopedTable`) and verifies every registered tenant table has `relrowsecurity = true` and `relforcerowsecurity = true`. Our two new tables must appear and pass.

- [ ] **Step 4.4: Final verification commit**

```bash
git status
```

Confirm no untracked files beyond the four expected ones. Then stage specifically:

```bash
git add \
  packages/db/src/migrations/0067_collections.sql \
  packages/db/src/schema/collections.ts \
  packages/db/src/schema/index.ts \
  apps/api/test/collections-tenant-isolation.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(a2): complete Story A2 — collections schema, RLS, composite FK guards

Migration 0067: adds UNIQUE(shop_id,id) pre-condition to product_images;
creates collections + collection_products with ENABLE/FORCE RLS, composite
FK pattern (shop_id,…) blocking cross-tenant references at DB layer,
ON DELETE CASCADE on join rows preserving products on collection delete.
Drizzle schema exported from @goldsmith/db. 10 integration tests green.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Rollback

If migration 0067 needs to be reverted before merge:

```sql
BEGIN;
ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_shop_image_fkey;
DROP TABLE IF EXISTS collection_products CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
ALTER TABLE product_images DROP CONSTRAINT IF EXISTS product_images_shop_id_id_uniq;
COMMIT;
```

Delete `packages/db/src/migrations/0067_collections.sql`, `packages/db/src/schema/collections.ts`, remove the `export * from './collections'` line from `index.ts`, rebuild.

---

## Runtime Smoke (Class A gate — before push)

Apply migration to the local Postgres instance and probe the invariants manually:

```bash
# Apply migration
psql $DATABASE_URL -f packages/db/src/migrations/0067_collections.sql

# Verify tables + RLS
psql $DATABASE_URL -c "\d collections"
psql $DATABASE_URL -c "\d collection_products"
psql $DATABASE_URL -c "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('collections', 'collection_products')"
# Expected: both rows have t | t

# Verify UNIQUE pre-condition on product_images
psql $DATABASE_URL -c "\d product_images" | grep shop_id_id_uniq
# Expected: product_images_shop_id_id_uniq

# Seed smoke
psql $DATABASE_URL <<'SQL'
SET app.current_shop_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SET ROLE app_user;
INSERT INTO collections (shop_id, slug, title_hi) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bridal-2026', 'ब्राइडल कलेक्शन 2026');
SELECT id, slug, title_hi, published_at, is_premium FROM collections;
RESET ROLE;
SQL
```

Note: If `DATABASE_URL` is not set (local dev without Docker), the integration tests via testcontainers substitute for this step — they spin up their own Postgres 15.6 instance.
