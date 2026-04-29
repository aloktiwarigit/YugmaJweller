-- 0042_estimates.sql
-- Proforma estimate (FR41): draft price quote before invoice finalisation.
-- Compliance checks (269ST, PAN, PMLA, TCS, HUID) fire only on conversion, not on estimate.
-- Gold rate is snapshotted at estimate creation; conversion reuses the snapshot, not live rates.

BEGIN;

CREATE TABLE estimates (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                    UUID NOT NULL REFERENCES shops(id),
  customer_id                UUID REFERENCES customers(id),
  line_items                 JSONB NOT NULL DEFAULT '[]',
  gold_rate_paise_per_gram   BIGINT NOT NULL,
  subtotal_paise             BIGINT NOT NULL,
  gst_paise                  BIGINT NOT NULL DEFAULT 0,
  total_paise                BIGINT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','sent','converted','expired')),
  expires_at                 TIMESTAMPTZ,
  converted_invoice_id       UUID REFERENCES invoices(id),
  created_by_user_id         UUID NOT NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_estimates_tenant_isolation ON estimates;
CREATE POLICY rls_estimates_tenant_isolation ON estimates
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

REVOKE ALL ON estimates FROM app_user;
GRANT SELECT, INSERT, UPDATE ON estimates TO app_user;

CREATE INDEX idx_estimates_shop_status
  ON estimates(shop_id, status, created_at DESC);
CREATE INDEX idx_estimates_shop_customer
  ON estimates(shop_id, customer_id, created_at DESC);

COMMIT;
