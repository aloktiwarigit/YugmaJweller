-- 0007_staff_invite_columns.sql
-- Adds invited_by_user_id and invited_at to shop_users.
-- No RLS change needed — existing shop_id-scoped policy covers new columns.
ALTER TABLE shop_users
  ADD COLUMN invited_by_user_id UUID REFERENCES shop_users(id),
  ADD COLUMN invited_at TIMESTAMPTZ;

GRANT UPDATE (invited_by_user_id, invited_at) ON shop_users TO app_user;
