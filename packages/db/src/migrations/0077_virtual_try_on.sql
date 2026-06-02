-- Migration 0077: Virtual Try-On (VTO)
--
-- Adds the data the try-on feature needs to render jewellery true-to-size:
--   1. Optional real-world physical dimensions (mm) on products. Weight is NOT
--      a usable size proxy (volume != shape), so true-to-size requires real mm.
--      These are compliance-neutral display fields, NOT money/weight columns.
--   2. product_try_on_assets: one transparent-PNG cutout + anchor + body-part
--      per product, kept off the hot product_images path. Tenant-scoped + RLS.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Physical dimension columns on products (all optional)
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS try_on_length_mm   DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS try_on_width_mm    DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS try_on_diameter_mm DECIMAL(8,2);

-- ---------------------------------------------------------------------------
-- 2. product_try_on_assets — cutout + placement metadata
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_try_on_assets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL,
  source_image_id    UUID,
  body_part          TEXT NOT NULL,
  asset_storage_key  TEXT,
  anchor_x           DECIMAL(5,4) NOT NULL DEFAULT 0.5,
  anchor_y           DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  status             TEXT NOT NULL DEFAULT 'pending',
  enabled            BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pta_shop_product_fkey
    FOREIGN KEY (shop_id, product_id)
    REFERENCES products (shop_id, id) ON DELETE CASCADE,
  CONSTRAINT pta_shop_image_fkey
    FOREIGN KEY (shop_id, source_image_id)
    REFERENCES product_images (shop_id, id) ON DELETE SET NULL (source_image_id),
  CONSTRAINT product_try_on_assets_body_part_chk
    CHECK (body_part IN ('EAR', 'NECK', 'FINGER', 'WRIST')),
  CONSTRAINT product_try_on_assets_status_chk
    CHECK (status IN ('pending', 'ready', 'failed')),
  CONSTRAINT product_try_on_assets_anchor_x_rng CHECK (anchor_x >= 0 AND anchor_x <= 1),
  CONSTRAINT product_try_on_assets_anchor_y_rng CHECK (anchor_y >= 0 AND anchor_y <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_try_on_assets_product
  ON product_try_on_assets (shop_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_try_on_assets_shop
  ON product_try_on_assets (shop_id);

ALTER TABLE product_try_on_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_try_on_assets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_product_try_on_assets_tenant_isolation ON product_try_on_assets;
CREATE POLICY rls_product_try_on_assets_tenant_isolation ON product_try_on_assets
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

REVOKE ALL ON product_try_on_assets FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_try_on_assets TO app_user;

COMMIT;
