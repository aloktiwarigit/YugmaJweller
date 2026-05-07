# Story A1+A3 — Products Storefront Schema

Date: 2026-05-06  
Branch: `feat/storefront-schema-a1a3`  
Class: A (RLS-touching schema migration — fresh session, full ceremony)  
Migrations: `0066_products_storefront_columns.sql` (A1), `0068_products_primary_image.sql` (A3)  
Reserved: `0067` belongs to `feat/storefront-collections-a2` — **never consume in this branch**

---

## Context

The customer storefront (Phase B onwards) needs server-side filter+sort on style, occasion, gift_persona, price, and featured score. The ProductCard needs a first-class `primary_image_id` on the product row so Phase B list queries can join a single image per product without a subquery per row. This story is the pure schema foundation — no API changes, no UI changes.

---

## Decisions locked

### D1 — `style`: CHECK constraint, not PostgreSQL enum type

PostgreSQL `ENUM` types require `ALTER TYPE ... ADD VALUE` (ShareRowExclusiveLock) to grow; CHECK constraints are altered without locks. The 12-value style list will grow (CHANDBALI, MAANG-TIKKA, etc.) as the product catalog expands — each addition should be a one-line migration, not a type migration.

### D2 — `occasion` / `gift_persona`: TEXT[] with GIN, not lookup tables

At anchor scale (≤ 5k SKU/tenant), a GIN-indexed `ANY(occasion)` query is sub-millisecond and requires zero JOINs. Lookup tables would add 2 new tables + RLS policies + grants each for no measurable benefit until the 10th tenant. TEXT[] values are validated at the application layer via `CATALOG_OCCASIONS` / `CATALOG_GIFT_PERSONAS` constant arrays in `@goldsmith/customer-shared` (Phase A4).

### D3 — `primary_image_id` maintenance: trigger with SECURITY INVOKER

A DB trigger is the only mechanism that covers all mutation paths: `ProductImagesService.upload()`, `delete()`, `reorder()`, direct-SQL seeds, admin scripts, migrations. App-level maintenance in the service would leave `primary_image_id` stale on any path that bypasses the service. `SECURITY INVOKER` keeps RLS in force during trigger execution — the trigger cannot reach across tenants. `SECURITY DEFINER` is explicitly banned on this trigger (brief non-negotiable).

---

## Migration 0066 — Products storefront columns

### New columns

| Column | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `style` | TEXT | YES | — | CHECK in style enum below |
| `occasion` | TEXT[] | NO | `'{}'` | — |
| `gift_persona` | TEXT[] | NO | `'{}'` | — |
| `featured_score` | SMALLINT | NO | `0` | CHECK 0 ≤ x ≤ 100 |
| `sales_count_30d` | INT | NO | `0` | — |
| `view_count_30d` | INT | NO | `0` | — |
| `price_snapshot_paise` | BIGINT | YES | — | — |
| `price_snapshot_at` | TIMESTAMPTZ | YES | — | — |
| `published_search_idx_at` | TIMESTAMPTZ | YES | — | — |

**Style CHECK values:** `ENGAGEMENT`, `COUPLE`, `DAILY_WEAR`, `JHUMKA`, `STUDS`, `HOOPS`, `DROP`, `STATEMENT`, `TEMPLE`, `BRIDAL`, `OFFICE`, `KIDS`

### Indexes

| Index name | Type | Columns | Predicate |
|---|---|---|---|
| `products_style_idx` | BTree | `(shop_id, style)` | `WHERE published_at IS NOT NULL` |
| `products_occasion_gin_idx` | GIN | `(occasion)` | — |
| `products_gift_persona_gin_idx` | GIN | `(gift_persona)` | — |
| `products_featured_idx` | BTree | `(shop_id, featured_score DESC)` | `WHERE published_at IS NOT NULL AND featured_score > 0` |
| `products_price_snapshot_idx` | BTree | `(shop_id, price_snapshot_paise)` | `WHERE price_snapshot_paise IS NOT NULL AND published_at IS NOT NULL` |
| `products_top_sellers_idx` | BTree expression | `(shop_id, (sales_count_30d*2+view_count_30d) DESC, published_at DESC)` | `WHERE published_at IS NOT NULL` |
| `products_search_trgm_idx` | GIN `gin_trgm_ops` | `(coalesce(sku,'')\|\|' '\|\|coalesce(metal,'')\|\|' '\|\|coalesce(purity,''))` | `WHERE published_at IS NOT NULL` |

Extension: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — runs before the trigram index, idempotent.

### Backfill

None. All new columns have safe NULL / empty array / 0 defaults. No per-row UPDATE required.

### Weight columns invariant

Migration MUST NOT alter `gross_weight_g` or `net_weight_g`. Both must remain `DECIMAL(12,4)`. Plan tests verify `\d products` after migration shows the correct type.

### Rollback DDL

```sql
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
-- pg_trgm extension NOT dropped (may be used elsewhere; idempotent to leave)
```

---

## Migration 0068 — `products.primary_image_id` + maintain trigger

### Column

```sql
ALTER TABLE products
  ADD COLUMN primary_image_id UUID;
```

Plain FK added first (see composite FK step below for replacement).

### Composite FK (closes cross-tenant loophole — mirrors 0058 pattern)

Step 1 — add UNIQUE on `product_images(shop_id, id)` as composite FK target:
```sql
ALTER TABLE product_images
  ADD CONSTRAINT product_images_shop_id_id_uniq UNIQUE (shop_id, id);
```

Step 2 — add composite FK on `products`:
```sql
ALTER TABLE products
  ADD CONSTRAINT products_shop_primary_image_fkey
  FOREIGN KEY (shop_id, primary_image_id)
  REFERENCES product_images(shop_id, id)
  ON DELETE SET NULL;
```

This means `UPDATE products SET primary_image_id = $b_image_id WHERE id = $a_product_id` fails at the DB layer (FK violation) when `shop_id` doesn't match — not just at the RLS layer. Double protection: RLS blocks the read; FK blocks the write.

### Backfill

```sql
UPDATE products
   SET primary_image_id = (
     SELECT pi.id
       FROM product_images pi
      WHERE pi.product_id = products.id
        AND pi.scan_status = 'clean'
      ORDER BY pi.sort_order ASC
      LIMIT 1
   );
```

Products with no clean image remain NULL — correct and safe. The trigger will keep this current going forward.

### Trigger function `maintain_products_primary_image()`

```sql
CREATE OR REPLACE FUNCTION maintain_products_primary_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER  -- NEVER SECURITY DEFINER: must not bypass RLS
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- Determine affected product_id from NEW or OLD depending on operation
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE products
     SET primary_image_id = (
       SELECT pi.id
         FROM product_images pi
        WHERE pi.product_id = v_product_id
          AND pi.scan_status = 'clean'
        ORDER BY pi.sort_order ASC
        LIMIT 1
     )
   WHERE id = v_product_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_maintain_products_primary_image
AFTER INSERT OR DELETE OR UPDATE OF sort_order, scan_status
ON product_images
FOR EACH ROW
EXECUTE FUNCTION maintain_products_primary_image();
```

**Key invariants:**
- `SECURITY INVOKER` — trigger runs with the session user's grants; RLS policy on `products` and `product_images` stays active
- `FOR EACH ROW` — one UPDATE per modified image row; cannot cross tenant boundary under RLS
- `COALESCE(NEW.product_id, OLD.product_id)` — handles DELETE (NEW is null) and INSERT/UPDATE (OLD may be null). AFTER trigger return value is ignored by Postgres; `RETURN NEW` is conventional.
- UPDATE targets `products WHERE id = v_product_id` — scope is a single product row, well within RLS fence

### Rollback DDL

```sql
DROP TRIGGER IF EXISTS trg_maintain_products_primary_image ON product_images;
DROP FUNCTION IF EXISTS maintain_products_primary_image();
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_shop_primary_image_fkey,
  DROP COLUMN IF EXISTS primary_image_id;
ALTER TABLE product_images
  DROP CONSTRAINT IF EXISTS product_images_shop_id_id_uniq;
```

---

## Drizzle schema (`packages/db/src/schema/products.ts`)

New exports:

```typescript
export const CATALOG_STYLES = [
  'ENGAGEMENT','COUPLE','DAILY_WEAR','JHUMKA','STUDS','HOOPS',
  'DROP','STATEMENT','TEMPLE','BRIDAL','OFFICE','KIDS',
] as const;
export type CatalogStyle = typeof CATALOG_STYLES[number];
```

New columns added to `tenantScopedTable`:

```typescript
style:                   text('style'),                                    // nullable
occasion:                text('occasion').array().notNull().default(sql`'{}'::text[]`),
gift_persona:            text('gift_persona').array().notNull().default(sql`'{}'::text[]`),
featured_score:          smallint('featured_score').notNull().default(0),
sales_count_30d:         integer('sales_count_30d').notNull().default(0),
view_count_30d:          integer('view_count_30d').notNull().default(0),
price_snapshot_paise:    bigint('price_snapshot_paise', { mode: 'bigint' }),
price_snapshot_at:       timestamp('price_snapshot_at', { withTimezone: true }),
published_search_idx_at: timestamp('published_search_idx_at', { withTimezone: true }),
primary_image_id:        uuid('primary_image_id'),
```

`bigint` mode `'bigint'` (native BigInt) for `price_snapshot_paise` — consistent with all other paise columns.

---

## Mandatory test assertions — all six must have explicit Red phases in the plan

Per `feedback_spec_lessons_need_plan_assertions.md`: spec-level security lessons must appear as explicit failing test cases in the plan, not just design-decisions prose.

| # | Test name | Assertion |
|---|---|---|
| T1 | `'primary_image_id FK does not bypass RLS via cross-tenant image'` | Set `app.current_shop_id = $shop_a`; execute `UPDATE products SET primary_image_id = $b_image_id WHERE id = $a_product_id`; expect FK constraint violation (`23503`) |
| T2 | `'maintain trigger respects RLS under SECURITY INVOKER'` | As `app_user` with `$shop_a` context, delete an image owned by `$shop_a`; verify `products.primary_image_id` recomputed for `$shop_a.product` only; `$shop_b.products` unchanged |
| T3 | `'CHECK constraint blocks invalid style'` | `INSERT INTO products (..., style) VALUES (..., 'UNKNOWN')` → expect `23514` (CHECK violation) |
| T4 | `'GIN occasion index used by ANY(...)'` | `EXPLAIN (FORMAT JSON) SELECT id FROM products WHERE 'WEDDING' = ANY(occasion)` → plan JSON contains `products_occasion_gin_idx` and node type `Bitmap Index Scan` |
| T5 | `'composite top-sellers index used by ORDER BY'` | `EXPLAIN (FORMAT JSON) SELECT id FROM products WHERE shop_id = $1 AND published_at IS NOT NULL ORDER BY (sales_count_30d*2+view_count_30d) DESC` → plan JSON contains `products_top_sellers_idx` |
| T6 | `'pg_trgm index used by similarity'` | `EXPLAIN (FORMAT JSON) SELECT id FROM products WHERE (coalesce(sku,'')||' '||coalesce(metal,'')||' '||coalesce(purity,'')) % 'AB-1042'` → plan JSON contains `products_search_trgm_idx` |

---

## Work stream outline

| WS | Scope | Notes |
|---|---|---|
| WS-A | Migration 0066 SQL + rollback DDL | Run in transaction; verify weight columns unchanged |
| WS-B | Migration 0068 SQL (UNIQUE + composite FK + backfill + trigger) | After WS-A committed (UNIQUE on product_images required) |
| WS-C | Trigger integration tests T1 + T2 (Red→Green) | Parallel with WS-D; uses tenant-isolation harness |
| WS-D | RLS + cross-tenant safety direct-SQL tests (T1 cross-tenant FK) | Parallel with WS-C |
| WS-E | Index EXPLAIN smoke tests T3–T6 (Red→Green with seeded data) | After WS-A+B applied to test DB |
| WS-F | Drizzle schema updates + type exports | Parallel with WS-C/D; typecheck must pass |

### Review gate

Codex review run from `C:\Alok\Business Projects\Goldsmith` (not the worktree) per `feedback_codex_worktree_clm.md`. `/security-review` on HEAD in parallel. Both `.codex-review-passed` and `.security-review-passed` markers required before push.

### Runtime smoke

```bash
psql $DATABASE_URL -f packages/db/src/migrations/0066_products_storefront_columns.sql
psql $DATABASE_URL -f packages/db/src/migrations/0068_products_primary_image.sql
pnpm --filter @goldsmith/api test:tenant-isolation
```

Rollback DDL validated on a scratch database before marking WS-B complete.

---

## Out of scope (deferred to Phase B)

- `sales_count_30d` / `view_count_30d` population (BullMQ rollup job — B7)
- `price_snapshot_paise` population (debounced rate-update job — B7)
- `published_search_idx_at` updates (Meilisearch wiring — post-SOW)
- Any API changes to `catalog.service.ts` or `CatalogController`
- Drizzle migration runner wiring — migrations applied via `psql` for now

---

## Non-negotiable floor (verified at story close)

- `gross_weight_g` and `net_weight_g` remain `DECIMAL(12,4)` — verified by `\d products` after migration
- Every index on `products` is `(shop_id, ...)` composite — no cross-tenant full-table scan possible
- `SECURITY INVOKER` on trigger — never `SECURITY DEFINER`
- Composite FK on `primary_image_id` — plain FK alone is insufficient
- `git grep` for all 6 new column names across migration + schema + tests before claiming complete
