-- Story viewing-analytics: product_views event table (FR64-68).
-- Consent gate is enforced at write time by analytics.service.ts.
-- Anonymous views (customer_id IS NULL) are always allowed.

CREATE TABLE product_views (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID        NOT NULL REFERENCES shops(id),
  product_id       UUID        NOT NULL REFERENCES products(id),
  customer_id      UUID,
  session_id       UUID        NOT NULL,
  viewed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER
);

ALTER TABLE product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_views FORCE ROW LEVEL SECURITY;

CREATE POLICY product_views_tenant ON product_views
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT ON product_views TO app_user;

CREATE INDEX idx_product_views_product_time
  ON product_views (product_id, viewed_at DESC);

CREATE INDEX idx_product_views_session
  ON product_views (session_id, product_id, viewed_at DESC);
