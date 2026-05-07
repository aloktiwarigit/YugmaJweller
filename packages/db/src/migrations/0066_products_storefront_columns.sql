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
-- Non-partial so it is unambiguously chosen by the planner for trgm similarity
-- queries regardless of other partial BTree indexes on this table.
CREATE INDEX products_search_trgm_idx
  ON products USING GIN (
    (coalesce(sku, '') || ' ' || coalesce(metal, '') || ' ' || coalesce(purity, ''))
    gin_trgm_ops
  );

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
