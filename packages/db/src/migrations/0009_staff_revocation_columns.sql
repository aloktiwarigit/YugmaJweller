-- 0009_staff_revocation_columns.sql
-- Adds revocation audit trail to shop_users.
-- Both columns are nullable: pre-existing rows have no revocation data.
ALTER TABLE shop_users
  ADD COLUMN revoked_at           TIMESTAMPTZ,
  ADD COLUMN revoked_by_user_id   UUID REFERENCES shop_users(id);
