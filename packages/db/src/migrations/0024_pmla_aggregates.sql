-- Migration 0024: Section 269ST cash-cap aggregates + invoice compliance override column
-- Story 5.4

-- 1. Daily/monthly cash aggregate per customer per shop.
--    NULLS NOT DISTINCT: walk-in customers with both customer_id=NULL and
--    customer_phone=NULL are correctly treated as a single anonymous bucket.
CREATE TABLE pmla_aggregates (
  shop_id          UUID NOT NULL REFERENCES shops(id),
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID,
  customer_phone   TEXT,
  aggregate_date   DATE NOT NULL,
  aggregate_month  TEXT NOT NULL,
  cash_total_paise BIGINT NOT NULL DEFAULT 0,
  invoice_count    INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pmla_aggregates_unique
    UNIQUE NULLS NOT DISTINCT (shop_id, aggregate_date, customer_id, customer_phone)
);

ALTER TABLE pmla_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY pmla_aggregates_tenant ON pmla_aggregates
  USING (shop_id = current_setting('app.current_shop_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE ON pmla_aggregates TO app_user;

CREATE INDEX idx_pmla_aggregates_lookup
  ON pmla_aggregates(shop_id, aggregate_date, customer_id);
CREATE INDEX idx_pmla_aggregates_monthly
  ON pmla_aggregates(shop_id, aggregate_month, customer_id);

-- 2. Store supervisor override metadata on the invoice when cash-cap is overridden.
ALTER TABLE invoices
  ADD COLUMN compliance_overrides_jsonb JSONB;

-- 3. Add idempotency key to payments so cash-payment endpoint retries are safe.
--    Partial unique index: NULL keys (non-idempotent writes) are excluded.
ALTER TABLE payments ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX uq_payments_shop_idempotency
  ON payments(shop_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
