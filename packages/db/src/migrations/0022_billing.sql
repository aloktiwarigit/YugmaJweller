-- 0022_billing.sql
-- B2C billing foundation: invoices + invoice_items + payments.
-- Server-authoritative pricing; GST persisted per-line and rolled up on invoice.
-- Idempotency enforced by UNIQUE(shop_id, idempotency_key).
-- Invoice numbers unique per tenant via UNIQUE(shop_id, invoice_number).
-- payments table is stubbed here for FK; Story 5.7 wires recording.

BEGIN;

-- 1. invoices
CREATE TABLE invoices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            UUID NOT NULL REFERENCES shops(id),
  invoice_number     TEXT NOT NULL,
  invoice_type       TEXT NOT NULL DEFAULT 'B2C'
                       CHECK (invoice_type IN ('B2C','B2B_WHOLESALE')),
  customer_id        UUID,                              -- nullable until Epic 6 lands customers
  customer_name      TEXT NOT NULL CHECK (length(customer_name) >= 1),
  customer_phone     TEXT,
  status             TEXT NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT','ISSUED','VOIDED')),
  subtotal_paise     BIGINT NOT NULL CHECK (subtotal_paise   >= 0),
  gst_metal_paise    BIGINT NOT NULL CHECK (gst_metal_paise  >= 0),
  gst_making_paise   BIGINT NOT NULL CHECK (gst_making_paise >= 0),
  total_paise        BIGINT NOT NULL CHECK (total_paise      >  0),
  idempotency_key    TEXT NOT NULL,
  issued_at          TIMESTAMPTZ,
  created_by_user_id UUID NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. invoice_items — line-level breakdown; product_id nullable for manual lines
CREATE TABLE invoice_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               UUID NOT NULL REFERENCES shops(id),
  invoice_id            UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id            UUID REFERENCES products(id),         -- nullable for manual lines
  description           TEXT NOT NULL CHECK (length(description) >= 1),
  hsn_code              TEXT NOT NULL DEFAULT '7113',         -- jewellery; 7114 for goldsmith articles
  huid                  TEXT,
  metal_type            TEXT,
  purity                TEXT,
  net_weight_g          DECIMAL(12,4),
  rate_per_gram_paise   BIGINT,
  making_charge_pct     DECIMAL(5,2),
  gold_value_paise      BIGINT NOT NULL CHECK (gold_value_paise      >= 0),
  making_charge_paise   BIGINT NOT NULL CHECK (making_charge_paise   >= 0),
  stone_charges_paise   BIGINT NOT NULL DEFAULT 0 CHECK (stone_charges_paise >= 0),
  hallmark_fee_paise    BIGINT NOT NULL DEFAULT 0 CHECK (hallmark_fee_paise  >= 0),
  gst_metal_paise       BIGINT NOT NULL CHECK (gst_metal_paise       >= 0),
  gst_making_paise      BIGINT NOT NULL CHECK (gst_making_paise      >= 0),
  line_total_paise      BIGINT NOT NULL CHECK (line_total_paise      >  0),
  sort_order            INTEGER NOT NULL DEFAULT 0
);

-- 3. payments — stub for Story 5.7, referenced as FK target by future tables
CREATE TABLE payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            UUID NOT NULL REFERENCES shops(id),
  invoice_id         UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  method             TEXT NOT NULL
                       CHECK (method IN ('CASH','UPI','CARD','NET_BANKING','OLD_GOLD','SCHEME')),
  amount_paise       BIGINT NOT NULL CHECK (amount_paise > 0),
  status             TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING','CONFIRMED','FAILED')),
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID NOT NULL
);

-- 4. RLS — same pattern as invoices/audit_events/products
ALTER TABLE invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices       FORCE ROW LEVEL SECURITY;
ALTER TABLE invoice_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items  FORCE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_invoices_tenant_isolation       ON invoices;
DROP POLICY IF EXISTS rls_invoice_items_tenant_isolation  ON invoice_items;
DROP POLICY IF EXISTS rls_payments_tenant_isolation       ON payments;

CREATE POLICY rls_invoices_tenant_isolation ON invoices
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

CREATE POLICY rls_invoice_items_tenant_isolation ON invoice_items
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

CREATE POLICY rls_payments_tenant_isolation ON payments
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

-- 5. Grants — invoices is read/write; payments is read/write (5.7 will INSERT)
REVOKE ALL ON invoices       FROM app_user;
REVOKE ALL ON invoice_items  FROM app_user;
REVOKE ALL ON payments       FROM app_user;
GRANT  SELECT, INSERT, UPDATE ON invoices       TO app_user;
GRANT  SELECT, INSERT         ON invoice_items  TO app_user;
GRANT  SELECT, INSERT, UPDATE ON payments       TO app_user;

-- 6. Uniqueness — one invoice per tenant idempotency-key, one number per tenant
CREATE UNIQUE INDEX uq_invoices_shop_idempotency
  ON invoices(shop_id, idempotency_key);
CREATE UNIQUE INDEX uq_invoices_shop_number
  ON invoices(shop_id, invoice_number);

-- 7. Hot-path indexes — list by customer, list by date, items by invoice
CREATE INDEX idx_invoices_customer
  ON invoices(shop_id, customer_id, created_at DESC);
CREATE INDEX idx_invoices_created_at
  ON invoices(shop_id, created_at DESC);
CREATE INDEX idx_invoice_items_invoice
  ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_shop
  ON invoice_items(shop_id);
CREATE INDEX idx_payments_invoice
  ON payments(invoice_id);
CREATE INDEX idx_payments_shop
  ON payments(shop_id, recorded_at DESC);

-- 8. updated_at touch trigger on invoices (mirrors products)
CREATE OR REPLACE FUNCTION invoices_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_touch_updated_at ON invoices;
CREATE TRIGGER trg_invoices_touch_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoices_touch_updated_at();

COMMIT;
