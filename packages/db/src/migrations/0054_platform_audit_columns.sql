-- 0054_platform_audit_columns.sql
-- Adds platform_user_id and target_shop_id to platform_audit_events. Both nullable
-- because legacy rows (TENANT_BOOT, AUTH_*) have no actor or target shop.
-- Action and metadata columns already exist (0003).

ALTER TABLE platform_audit_events
  ADD COLUMN IF NOT EXISTS platform_user_id TEXT,
  ADD COLUMN IF NOT EXISTS target_shop_id   UUID;

-- Foreign key kept loose (NO REFERENCES) — platform_audit_events is append-only and
-- must not be coupled to shops lifecycle (a deleted shop should not break audit reads).

CREATE INDEX IF NOT EXISTS platform_audit_events_target_shop_idx
  ON platform_audit_events (target_shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_events_platform_user_idx
  ON platform_audit_events (platform_user_id, created_at DESC);
