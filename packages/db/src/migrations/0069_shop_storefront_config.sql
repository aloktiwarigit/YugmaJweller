-- 0069_shop_storefront_config.sql
-- Add storefront_config_json JSONB column to shop_settings.
--
-- Shape is enforced at the API layer via StorefrontConfigSchema in @goldsmith/shared.
-- The DB stores '{}' (empty object) until a tenant overrides; the service layer merges
-- STOREFRONT_CONFIG_DEFAULTS on read (in catalog.service.getStorefrontConfig, Phase B).
-- No DB-side trigger or generated column — code-side merge follows the pattern of
-- making_charges_json, wastage_json, notification_prefs_json.
--
-- RLS: shop_settings already has rls_shop_settings_tenant_isolation covering FOR ALL
-- (USING shop_id = current_setting('app.current_shop_id')::uuid) — new column
-- inherits protection automatically. No new policy needed.
--
-- GRANT: existing GRANT SELECT, INSERT, UPDATE ON shop_settings TO app_user (migration 0006)
-- already covers all columns including this one. No new grant needed.

ALTER TABLE shop_settings
  ADD COLUMN storefront_config_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN shop_settings.storefront_config_json IS
  'Tenant homepage curation config. DB stores empty {}; service merges STOREFRONT_CONFIG_DEFAULTS on read (Phase B). '
  'Zod-validated via StorefrontConfigSchema in @goldsmith/shared. No GIN index until query patterns require it.';
