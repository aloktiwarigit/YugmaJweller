-- 0021_stock_movements.sql
-- Append-only ledger of stock changes. Drives products.quantity.
-- DB-enforced immutability via trigger; compensating movements correct mistakes.
-- PMLA 5-year retention enforced at two layers:
--   1. Immutability trigger with SECURITY DEFINER (rejects UPDATE/DELETE for ALL roles)
--   2. app_user grant restricted to SELECT + INSERT (denies privilege at role level)

BEGIN;

-- 1. products.quantity column (drives oversell guard; default 1 for existing rows)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1
  CONSTRAINT products_quantity_nonneg CHECK (quantity >= 0);

-- 2. stock_movements append-only ledger
CREATE TABLE stock_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES shops(id),
  product_id          UUID NOT NULL REFERENCES products(id),
  type                TEXT NOT NULL CHECK (type IN (
                        'PURCHASE','SALE','ADJUSTMENT_IN','ADJUSTMENT_OUT',
                        'TRANSFER_IN','TRANSFER_OUT'
                      )),
  reason              TEXT NOT NULL CHECK (length(reason) >= 3),
  quantity_delta      INTEGER NOT NULL CHECK (quantity_delta != 0),
  balance_before      INTEGER NOT NULL CHECK (balance_before >= 0),
  balance_after       INTEGER NOT NULL CHECK (balance_after  >= 0),
  source_name         TEXT,
  source_id           UUID,
  -- recorded_by_user_id intentionally has no FK: the value must persist for 5 yr
  -- PMLA retention even if the user record is purged. Service layer validates write-time.
  recorded_by_user_id UUID NOT NULL,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Per-row sign invariant: delta direction must match type
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_delta_sign_matches_type CHECK (
  (type IN ('PURCHASE','ADJUSTMENT_IN','TRANSFER_IN')   AND quantity_delta > 0) OR
  (type IN ('SALE','ADJUSTMENT_OUT','TRANSFER_OUT')     AND quantity_delta < 0)
);

-- 4. Per-row balance invariant: balance_after must equal balance_before + delta
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_balance_consistent CHECK (
  balance_after = balance_before + quantity_delta
);

-- 5. RLS — same pattern as audit_events / sync_change_log
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_stock_movements_tenant_isolation ON stock_movements;
CREATE POLICY rls_stock_movements_tenant_isolation ON stock_movements
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

-- 6. Immutability trigger — DB-level rejection of UPDATE/DELETE.
-- This is the PMLA retention floor: even a buggy migration or a developer
-- with raw psql access cannot mutate or destroy a recorded movement.
CREATE OR REPLACE FUNCTION stock_movements_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements are immutable; use a compensating movement'
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON stock_movements;
CREATE TRIGGER trg_stock_movements_immutable
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION stock_movements_immutable();

-- 7. Grants — INSERT + SELECT only. No UPDATE / DELETE.
-- The trigger is defense-in-depth; the grant is the primary control.
REVOKE ALL ON stock_movements FROM app_user;
GRANT SELECT, INSERT ON stock_movements TO app_user;

-- 8. Indexes — product timeline + type aggregation
CREATE INDEX idx_stock_movements_product
  ON stock_movements(shop_id, product_id, recorded_at DESC);
CREATE INDEX idx_stock_movements_type
  ON stock_movements(shop_id, type, recorded_at DESC);
CREATE INDEX idx_stock_movements_recorded_by
  ON stock_movements(shop_id, recorded_by_user_id, recorded_at DESC);

COMMIT;
