-- Story 6.4: Customer credit balance
-- Stores per-customer outstanding/advance balance.
-- UNIQUE(shop_id, customer_id) — one balance row per customer per tenant.
-- RLS enforced: app_user can only see/modify rows for current_setting('app.current_shop_id').

CREATE TABLE customer_balances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           UUID NOT NULL REFERENCES shops(id),
  customer_id       UUID NOT NULL REFERENCES customers(id),
  outstanding_paise BIGINT NOT NULL DEFAULT 0,
  advance_paise     BIGINT NOT NULL DEFAULT 0,
  last_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_balances_unique UNIQUE (shop_id, customer_id)
);

ALTER TABLE customer_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_balances FORCE ROW LEVEL SECURITY;

CREATE POLICY customer_balances_tenant ON customer_balances
  USING (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON customer_balances TO app_user;

CREATE INDEX idx_customer_balances_shop_customer
  ON customer_balances (shop_id, customer_id);
