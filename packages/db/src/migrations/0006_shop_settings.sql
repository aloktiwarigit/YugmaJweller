-- 0006_shop_settings.sql
-- Part A: extend shops with mutable profile columns (all nullable)
ALTER TABLE shops
  ADD COLUMN address_json          JSONB,
  ADD COLUMN gstin                 TEXT,
  ADD COLUMN bis_registration      TEXT,
  ADD COLUMN contact_phone         TEXT,
  ADD COLUMN operating_hours_json  JSONB,
  ADD COLUMN about_text            TEXT,
  ADD COLUMN logo_url              TEXT,
  ADD COLUMN years_in_business     INT;

-- Part B: shops RLS for UPDATE (SELECT remains unrestricted for tenant boot + auth)
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_shops_select_all ON shops FOR SELECT USING (true);
CREATE POLICY rls_shops_update_own ON shops FOR UPDATE
  USING      (id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (id = current_setting('app.current_shop_id')::uuid);

GRANT UPDATE (
  display_name, address_json, gstin, bis_registration, contact_phone,
  operating_hours_json, about_text, logo_url, years_in_business, updated_at
) ON shops TO app_user;

-- Part C: shop_settings — one row per shop; Epic 2 config/preference home
CREATE TABLE shop_settings (
  shop_id                   UUID PRIMARY KEY REFERENCES shops(id) ON DELETE RESTRICT,
  making_charges_json       JSONB,
  wastage_json              JSONB,
  loyalty_json              JSONB,
  rate_lock_days            INT,
  try_at_home_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  try_at_home_max_pieces    INT,
  custom_order_policy_text  TEXT,
  return_policy_text        TEXT,
  notification_prefs_json   JSONB,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_shop_settings_tenant_isolation ON shop_settings
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON shop_settings TO app_user;
