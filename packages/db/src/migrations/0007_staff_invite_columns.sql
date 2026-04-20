-- 0007_staff_invite_columns.sql
-- Adds audit trail for who invited whom and when.
-- invited_by_user_id is nullable because pre-existing owner rows have no inviter.
ALTER TABLE shop_users
  ADD COLUMN invited_by_user_id UUID REFERENCES shop_users(id),
  ADD COLUMN invited_at         TIMESTAMPTZ;
