-- Migration 0030: URD purchases for old-gold exchange with RCM self-invoice
-- Story 5.9

CREATE TABLE urd_purchases (
  shop_id               UUID NOT NULL REFERENCES shops(id),
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID,
  customer_name         TEXT NOT NULL,
  customer_phone        TEXT,
  metal_type            TEXT NOT NULL CHECK (metal_type IN ('GOLD', 'SILVER')),
  purity                TEXT NOT NULL,
  weight_g              DECIMAL(12,4) NOT NULL CHECK (weight_g > 0),
  agreed_rate_paise     BIGINT NOT NULL CHECK (agreed_rate_paise > 0),
  gold_value_paise      BIGINT NOT NULL,
  rcm_gst_paise         BIGINT NOT NULL,
  net_to_customer_paise BIGINT NOT NULL,
  self_invoice_number   TEXT NOT NULL,
  self_invoice_text     TEXT NOT NULL,
  linked_invoice_id     UUID REFERENCES invoices(id),
  recorded_by_user_id   UUID NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE urd_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE urd_purchases FORCE ROW LEVEL SECURITY;

CREATE POLICY urd_purchases_tenant ON urd_purchases
  USING (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON urd_purchases TO app_user;

CREATE INDEX idx_urd_purchases_shop_created ON urd_purchases(shop_id, created_at DESC);
CREATE INDEX idx_urd_purchases_customer ON urd_purchases(shop_id, customer_id) WHERE customer_id IS NOT NULL;