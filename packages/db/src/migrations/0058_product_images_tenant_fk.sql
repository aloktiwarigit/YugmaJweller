-- packages/db/src/migrations/0058_product_images_tenant_fk.sql
-- Story 17.1 Codex round-1 follow-up — tenant-scoped composite FKs.
-- DDL-only per docs/db-workflow.md.
--
-- Why: 0057 used plain FKs (product_id -> products(id), uploaded_by_user_id ->
-- shop_users(id)). RLS filters on shop_id but does not enforce that the FK
-- target belongs to the same tenant. An attacker (compromised tenant or API
-- bug) could insert a product_images row pointing to another shop's product
-- or user. Composite FKs close this loophole at the schema layer.

BEGIN;

-- Step 1: Add UNIQUE(shop_id, id) on parent tables — required as composite FK
-- target. Both tables have shop_id NOT NULL today; pure metadata change.
ALTER TABLE products
  ADD CONSTRAINT products_shop_id_id_uniq UNIQUE (shop_id, id);

ALTER TABLE shop_users
  ADD CONSTRAINT shop_users_shop_id_id_uniq UNIQUE (shop_id, id);

-- Step 2: Drop the plain FKs from 0057.
ALTER TABLE product_images
  DROP CONSTRAINT product_images_product_id_fkey;

ALTER TABLE product_images
  DROP CONSTRAINT product_images_uploaded_by_user_id_fkey;

-- Step 3: Re-add as tenant-scoped composite FKs.
ALTER TABLE product_images
  ADD CONSTRAINT product_images_shop_product_fkey
  FOREIGN KEY (shop_id, product_id)
  REFERENCES products(shop_id, id)
  ON DELETE CASCADE;

ALTER TABLE product_images
  ADD CONSTRAINT product_images_shop_uploader_fkey
  FOREIGN KEY (shop_id, uploaded_by_user_id)
  REFERENCES shop_users(shop_id, id);

-- Step 4: F7 follow-on — idempotency key column + unique per-product constraint.
-- This supports the service-layer idempotency check in Task 4.
ALTER TABLE product_images
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX product_images_idempotency_uniq
  ON product_images (product_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;
