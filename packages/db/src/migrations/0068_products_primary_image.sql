-- packages/db/src/migrations/0068_products_primary_image.sql
-- Story A3 — products.primary_image_id with composite FK (mirrors 0058 pattern)
-- and a SECURITY INVOKER trigger to auto-maintain the column.
--
-- Security rationale: a plain FK (primary_image_id → product_images.id) would allow
-- a Tenant-A product to reference a Tenant-B image — the RLS policy on products
-- filters rows but does NOT prevent FK references into other tenants' images.
-- Composite FK (shop_id, primary_image_id) → product_images(shop_id, id) closes this
-- at the schema layer, mirroring the 0058 pattern for product_images → products.

BEGIN;

-- Step 1: UNIQUE constraint on product_images(shop_id, id) as composite FK target.
-- product_images.id is already a PRIMARY KEY (unique), but FKs can only reference
-- UNIQUE or PRIMARY KEY constraints. Adding an explicit UNIQUE(shop_id, id) lets
-- the composite FK reference (shop_id, id) while the primary key covers (id) alone.
-- Guard: migration 0067 (collections) also creates this constraint if it ran first.
-- When both migrations are applied in numeric order (0067 before 0068) the constraint
-- already exists; skip to avoid a duplicate-constraint error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_images_shop_id_id_uniq'
  ) THEN
    ALTER TABLE product_images ADD CONSTRAINT product_images_shop_id_id_uniq UNIQUE (shop_id, id);
  END IF;
END $$;

-- Step 2: Add primary_image_id column (nullable — NULL = no clean image available).
ALTER TABLE products
  ADD COLUMN primary_image_id UUID;

-- Step 3: Composite FK — blocks cross-tenant image association at the schema layer.
-- NO ON DELETE action: we cannot use ON DELETE SET NULL on a composite FK that includes
-- shop_id (NOT NULL) because Postgres would NULL all FK columns including shop_id.
-- Instead, a BEFORE DELETE trigger (trg_clear_products_primary_image) clears
-- primary_image_id before the image row is deleted, satisfying the FK. The AFTER DELETE
-- trigger (trg_maintain_products_primary_image) then recomputes from remaining images.
ALTER TABLE products
  ADD CONSTRAINT products_shop_primary_image_fkey
  FOREIGN KEY (shop_id, primary_image_id)
  REFERENCES product_images(shop_id, id);

-- Step 4: Backfill — set primary_image_id for products that already have clean images.
-- Products with no clean images remain NULL (correct and safe).
UPDATE products
   SET primary_image_id = (
     SELECT pi.id
       FROM product_images pi
      WHERE pi.product_id = products.id
        AND pi.scan_status = 'clean'
      ORDER BY pi.sort_order ASC, pi.created_at ASC
      LIMIT 1
   );

-- Step 5a: BEFORE DELETE/UPDATE(product_id) trigger function — clears primary_image_id
-- on the product before the image row is removed or reparented so the composite FK
-- constraint is satisfied.
-- SECURITY INVOKER: runs under session user privileges; RLS on products must allow
-- the UPDATE (withTenantTx sets the GUC that satisfies RLS for the owning tenant).
CREATE OR REPLACE FUNCTION clear_products_primary_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Clear primary_image_id only when the product currently points at this image.
  -- This avoids a spurious UPDATE when a non-primary image is deleted/moved away.
  -- On DELETE: OLD.product_id is the product that held this image.
  -- On UPDATE OF product_id: OLD.product_id is the product losing this image.
  UPDATE products
     SET primary_image_id = NULL
   WHERE id = OLD.product_id
     AND primary_image_id = OLD.id;

  -- BEFORE trigger: return OLD (DELETE) or NEW (UPDATE) to allow the operation to proceed.
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Fires BEFORE DELETE so the FK reference is cleared before the row is removed.
-- Also fires BEFORE UPDATE OF product_id so the old product's FK is cleared before
-- the image changes ownership (Codex P2 fix: handle same-shop reparenting).
CREATE TRIGGER trg_clear_products_primary_image
BEFORE DELETE OR UPDATE OF product_id
ON product_images
FOR EACH ROW
EXECUTE FUNCTION clear_products_primary_image();

-- Step 5b: AFTER trigger function. SECURITY INVOKER so RLS stays active during trigger
-- execution — the trigger UPDATE runs under the session user's privileges, not
-- a privileged role, preventing cross-tenant writes.
CREATE OR REPLACE FUNCTION maintain_products_primary_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- For product_id reparenting: recompute the OLD product first (Codex P2 fix).
  -- The BEFORE trigger has already cleared primary_image_id on OLD.product_id; now
  -- recompute it from whatever clean images remain on that product.
  IF (TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id) THEN
    UPDATE products
       SET primary_image_id = (
         SELECT pi.id
           FROM product_images pi
          WHERE pi.product_id = OLD.product_id
            AND pi.scan_status = 'clean'
          ORDER BY pi.sort_order ASC, pi.created_at ASC
          LIMIT 1
       )
     WHERE id = OLD.product_id;
  END IF;

  -- Recompute the NEW (or only) product's primary image.
  -- COALESCE handles DELETE (NEW is null) and INSERT/UPDATE (NEW.product_id).
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE products
     SET primary_image_id = (
       SELECT pi.id
         FROM product_images pi
        WHERE pi.product_id = v_product_id
          AND pi.scan_status = 'clean'
        ORDER BY pi.sort_order ASC, pi.created_at ASC
        LIMIT 1
     )
   WHERE id = v_product_id;

  -- AFTER trigger: return value is ignored by Postgres; RETURN NEW is conventional
  -- (RETURN NULL would also work for AFTER triggers).
  RETURN NEW;
END;
$$;

-- Fires after any of the five mutation events that can change which image is "primary":
--   INSERT              — new image added; may become primary if lowest sort_order
--   DELETE              — image removed; BEFORE trigger clears FK first, AFTER recomputes
--   UPDATE OF sort_order  — reorder can change which image is first
--   UPDATE OF scan_status — an image becoming 'clean' or 'rejected' changes eligibility
--   UPDATE OF product_id  — reparenting: recompute both old and new product (Codex P2 fix)
CREATE TRIGGER trg_maintain_products_primary_image
AFTER INSERT OR DELETE OR UPDATE OF sort_order, scan_status, product_id
ON product_images
FOR EACH ROW
EXECUTE FUNCTION maintain_products_primary_image();

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback DDL (validate on scratch DB before claiming Task 6 done)
-- ---------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trg_maintain_products_primary_image ON product_images;
-- DROP FUNCTION IF EXISTS maintain_products_primary_image();
-- DROP TRIGGER IF EXISTS trg_clear_products_primary_image ON product_images;
-- DROP FUNCTION IF EXISTS clear_products_primary_image();
-- ALTER TABLE products
--   DROP CONSTRAINT IF EXISTS products_shop_primary_image_fkey,
--   DROP COLUMN IF EXISTS primary_image_id;
-- ALTER TABLE product_images
--   DROP CONSTRAINT IF EXISTS product_images_shop_id_id_uniq;
