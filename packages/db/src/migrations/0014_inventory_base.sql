-- 0014_inventory_base.sql
-- Adds product_categories, products, product_images with RLS policies.

-- product_categories (tenant-scoped)
CREATE TABLE product_categories (
  shop_id    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  name_hi    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_categories_shop_id_idx ON product_categories (shop_id);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_product_categories_tenant_isolation ON product_categories;
CREATE POLICY rls_product_categories_tenant_isolation ON product_categories
  FOR ALL
  USING  (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

-- products (tenant-scoped)
CREATE TABLE products (
  shop_id                    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id                UUID REFERENCES product_categories(id),
  sku                        TEXT NOT NULL,
  metal                      TEXT NOT NULL,
  purity                     TEXT NOT NULL,
  gross_weight_g             DECIMAL(12,4) NOT NULL,
  net_weight_g               DECIMAL(12,4) NOT NULL,
  stone_weight_g             DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  stone_details              TEXT,
  making_charge_override_pct DECIMAL(5,2),
  huid                       TEXT,
  status                     TEXT NOT NULL DEFAULT 'IN_STOCK',
  published_at               TIMESTAMPTZ,
  published_by_user_id       UUID,
  created_by_user_id         UUID NOT NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_status_check        CHECK (status IN ('IN_STOCK','SOLD','RESERVED','ON_APPROVAL','WITH_KARIGAR')),
  CONSTRAINT products_metal_check         CHECK (metal  IN ('GOLD','SILVER','PLATINUM')),
  CONSTRAINT products_gross_weight_pos    CHECK (gross_weight_g > 0),
  CONSTRAINT products_net_weight_valid    CHECK (net_weight_g > 0 AND net_weight_g <= gross_weight_g),
  CONSTRAINT products_huid_format         CHECK (huid IS NULL OR huid ~* '^[A-Z0-9]{6}$')
);
CREATE INDEX products_shop_id_idx        ON products (shop_id);
CREATE INDEX products_shop_id_status_idx ON products (shop_id, status);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_products_tenant_isolation ON products;
CREATE POLICY rls_products_tenant_isolation ON products
  FOR ALL
  USING  (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

-- product_images (tenant-scoped)
CREATE TABLE product_images (
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  variant     TEXT NOT NULL DEFAULT 'original',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_images_shop_id_idx    ON product_images (shop_id);
CREATE INDEX product_images_product_id_idx ON product_images (product_id);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_product_images_tenant_isolation ON product_images;
CREATE POLICY rls_product_images_tenant_isolation ON product_images
  FOR ALL
  USING  (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

-- Explicit grants (default privileges from 0002 cover new tables,
-- but explicit grant matches the established per-story pattern).
GRANT SELECT, INSERT, UPDATE ON product_categories TO app_user;
GRANT SELECT, INSERT, UPDATE ON products           TO app_user;
GRANT SELECT, INSERT, UPDATE ON product_images     TO app_user;
