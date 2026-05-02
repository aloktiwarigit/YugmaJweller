-- packages/db/src/migrations/0057_product_images_pipeline.sql
-- Story 17.1 — recreate product_images for the real upload pipeline.
-- DDL-only (migrator role compatible). No DML inside .sql migrations
-- per docs/db-workflow.md.

BEGIN;

-- Drop the original 0014 table (zero production data; no FK dependencies).
-- CASCADE removes the policy + grants + indexes implicitly.
DROP TABLE product_images CASCADE;

-- Recreate with the full Story-17.1 schema.
CREATE TABLE product_images (
  shop_id              UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_key          TEXT        NOT NULL,
  alt_text             TEXT,
  mime_type            TEXT        NOT NULL,
  byte_size            BIGINT      NOT NULL,
  width                INTEGER     NOT NULL,
  height               INTEGER     NOT NULL,
  exif_stripped_at     TIMESTAMPTZ NOT NULL,
  uploaded_by_user_id  UUID        NOT NULL REFERENCES shop_users(id),
  scan_status          TEXT        NOT NULL DEFAULT 'clean'
    CHECK (scan_status IN ('pending', 'clean', 'rejected')),
  sort_order           INTEGER     NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX product_images_shop_id_idx       ON product_images (shop_id);
CREATE INDEX product_images_product_id_idx    ON product_images (product_id);
CREATE INDEX product_images_product_sort_idx  ON product_images (product_id, sort_order);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_product_images_tenant_isolation ON product_images;
CREATE POLICY rls_product_images_tenant_isolation ON product_images
  FOR ALL
  USING       (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK  (shop_id = current_setting('app.current_shop_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO app_user;

COMMIT;
