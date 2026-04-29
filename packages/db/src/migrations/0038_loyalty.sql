-- 0037_loyalty.sql
-- Loyalty foundation (Story 8.1).
-- 1. loyalty_transactions: append-only ledger. Parity with stock_movements (0021).
--    Immutability enforced at TWO layers:
--      (a) Immutability trigger with SECURITY DEFINER (rejects UPDATE/DELETE/TRUNCATE for ALL roles)
--      (b) app_user grant restricted to SELECT + INSERT (denies privilege at role level)
-- 2. customer_loyalty: running aggregate. One row per customer. Updated under FOR UPDATE
--    inside the same tx as the matching transaction insert.

BEGIN;

-- ============================================================================
-- 1. loyalty_transactions — append-only ledger
-- ============================================================================

CREATE TABLE loyalty_transactions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            UUID NOT NULL REFERENCES shops(id),
  customer_id        UUID NOT NULL REFERENCES customers(id),
  invoice_id         UUID REFERENCES invoices(id),
  type               TEXT NOT NULL CHECK (type IN (
                       'ACCRUAL','REDEMPTION','ADJUSTMENT_IN','ADJUSTMENT_OUT','REVERSAL'
                     )),
  points_delta       INTEGER NOT NULL CHECK (points_delta != 0),
  balance_before     INTEGER NOT NULL CHECK (balance_before >= 0),
  balance_after      INTEGER NOT NULL CHECK (balance_after  >= 0),
  reason             TEXT NOT NULL CHECK (length(reason) >= 3),
  -- created_by_user_id intentionally has no FK: worker-driven ACCRUAL rows pass NULL,
  -- and manual rows must persist after the user record is purged (DPDPA right-to-erasure).
  created_by_user_id UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-row sign invariant: delta direction must match type
ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_delta_sign_matches_type CHECK (
  (type IN ('ACCRUAL','ADJUSTMENT_IN')                AND points_delta > 0) OR
  (type IN ('REDEMPTION','ADJUSTMENT_OUT','REVERSAL') AND points_delta < 0)
);

-- Per-row balance invariant: balance_after must equal balance_before + delta
ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_balance_consistent CHECK (
  balance_after = balance_before + points_delta
);

-- RLS — same pattern as stock_movements
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_loyalty_transactions_tenant_isolation ON loyalty_transactions;
CREATE POLICY rls_loyalty_transactions_tenant_isolation ON loyalty_transactions
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

-- Immutability trigger — DB-level rejection of UPDATE/DELETE/TRUNCATE.
-- Even a buggy migration or a developer with raw psql access cannot mutate
-- or destroy a recorded loyalty transaction.
CREATE OR REPLACE FUNCTION loyalty_transactions_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'loyalty_transactions are immutable; insert a REVERSAL or ADJUSTMENT_OUT row instead'
    USING ERRCODE = 'restrict_violation';
END;
$$;

ALTER FUNCTION loyalty_transactions_immutable() OWNER TO platform_admin;

DROP TRIGGER IF EXISTS trg_loyalty_transactions_immutable ON loyalty_transactions;
CREATE TRIGGER trg_loyalty_transactions_immutable
  BEFORE UPDATE OR DELETE ON loyalty_transactions
  FOR EACH ROW EXECUTE FUNCTION loyalty_transactions_immutable();

DROP TRIGGER IF EXISTS trg_loyalty_transactions_no_truncate ON loyalty_transactions;
CREATE TRIGGER trg_loyalty_transactions_no_truncate
  BEFORE TRUNCATE ON loyalty_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION loyalty_transactions_immutable();

-- Grants — INSERT + SELECT only. The trigger is defense-in-depth.
REVOKE ALL ON loyalty_transactions FROM app_user;
GRANT SELECT, INSERT ON loyalty_transactions TO app_user;

-- Indexes — customer timeline + tenant scope
CREATE INDEX idx_loyalty_transactions_customer
  ON loyalty_transactions(shop_id, customer_id, created_at DESC);
-- Unique constraint prevents double-accrual if Redis idempotency key expires
-- (e.g. after a Redis flush or long-running retry window).
CREATE UNIQUE INDEX idx_loyalty_transactions_invoice_unique
  ON loyalty_transactions(shop_id, invoice_id)
  WHERE invoice_id IS NOT NULL AND txn_type = 'ACCRUAL';

-- ============================================================================
-- 2. customer_loyalty — running aggregate (one row per customer)
-- ============================================================================

CREATE TABLE customer_loyalty (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           UUID NOT NULL REFERENCES shops(id),
  customer_id       UUID NOT NULL REFERENCES customers(id),
  points_balance    INTEGER NOT NULL DEFAULT 0 CHECK (points_balance  >= 0),
  lifetime_points   INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  current_tier      TEXT,
  tier_since        TIMESTAMPTZ,
  last_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One aggregate row per customer (per shop, since customers is tenant-scoped)
  CONSTRAINT customer_loyalty_unique_customer UNIQUE (shop_id, customer_id)
);

-- RLS — same pattern
ALTER TABLE customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_loyalty FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_customer_loyalty_tenant_isolation ON customer_loyalty;
CREATE POLICY rls_customer_loyalty_tenant_isolation ON customer_loyalty
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

-- Grants — SELECT + INSERT + UPDATE (but no DELETE; soft-delete via app logic if ever needed)
REVOKE ALL ON customer_loyalty FROM app_user;
GRANT SELECT, INSERT, UPDATE ON customer_loyalty TO app_user;

-- Index for fast tier-bucket counts (Story 8.2)
CREATE INDEX idx_customer_loyalty_tier
  ON customer_loyalty(shop_id, current_tier) WHERE current_tier IS NOT NULL;

COMMIT;
