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
