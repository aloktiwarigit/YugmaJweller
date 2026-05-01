-- 0047_reviews_wishlist.sql
-- Product reviews (FR100-102) + customer wishlists (FR105).
-- Reviews: one per customer per product per shop, 1-5 star rating, optional text.
-- Wishlists: shop-scoped toggle (unique constraint prevents duplicates).

BEGIN;

-- ============================================================================
-- 1. product_reviews
-- ============================================================================

CREATE TABLE product_reviews (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID        NOT NULL REFERENCES shops(id),
  product_id    UUID        NOT NULL REFERENCES products(id),
  customer_id   UUID        NOT NULL REFERENCES customers(id),
  rating        SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One review per customer per product per shop
ALTER TABLE product_reviews ADD CONSTRAINT uq_review_customer_product
  UNIQUE (shop_id, customer_id, product_id);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_product_reviews_tenant_isolation ON product_reviews;
CREATE POLICY rls_product_reviews_tenant_isolation ON product_reviews
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

REVOKE ALL ON product_reviews FROM app_user;
GRANT SELECT, INSERT ON product_reviews TO app_user;

-- Fast lookup by product (review section on product detail)
CREATE INDEX idx_product_reviews_product
  ON product_reviews(shop_id, product_id, created_at DESC);

-- ============================================================================
-- 2. wishlists
-- ============================================================================

CREATE TABLE wishlists (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID        NOT NULL REFERENCES shops(id),
  customer_id UUID        NOT NULL REFERENCES customers(id),
  product_id  UUID        NOT NULL REFERENCES products(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_wishlist_customer_product UNIQUE (shop_id, customer_id, product_id)
);

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_wishlists_tenant_isolation ON wishlists;
CREATE POLICY rls_wishlists_tenant_isolation ON wishlists
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

REVOKE ALL ON wishlists FROM app_user;
GRANT SELECT, INSERT, DELETE ON wishlists TO app_user;

CREATE INDEX idx_wishlists_customer
  ON wishlists(shop_id, customer_id, created_at DESC);

COMMIT;
