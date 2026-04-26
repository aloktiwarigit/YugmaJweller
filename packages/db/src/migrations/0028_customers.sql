-- Story 6.1: Customer CRM Foundation
-- Phone uniqueness enforced per shop. PAN stored encrypted (bytea); plaintext never persisted.
-- viewing_consent: DPDPA stub — required column, defaults false.
CREATE TABLE customers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID NOT NULL REFERENCES shops(id),
  phone            TEXT NOT NULL,
  name             TEXT NOT NULL,
  email            TEXT,
  address_line1    TEXT,
  address_line2    TEXT,
  city             TEXT,
  state            TEXT,
  pincode          TEXT,
  dob_year         INTEGER,
  pan_ciphertext   BYTEA,
  pan_key_id       TEXT,
  notes            TEXT,
  viewing_consent  BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

CREATE POLICY customers_tenant_select ON customers
  FOR SELECT
  USING (shop_id = current_setting('app.current_shop_id')::uuid);

CREATE POLICY customers_tenant_insert ON customers
  FOR INSERT
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

CREATE POLICY customers_tenant_update ON customers
  FOR UPDATE
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON customers TO app_user;

CREATE UNIQUE INDEX idx_customers_shop_phone ON customers(shop_id, phone);
CREATE INDEX idx_customers_shop_name        ON customers(shop_id, name);
CREATE INDEX idx_customers_shop_created     ON customers(shop_id, created_at DESC);