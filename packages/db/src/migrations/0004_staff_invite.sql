-- Story 1.2: Add invite tracking columns to shop_users
ALTER TABLE shop_users
  ADD COLUMN invited_by_user_id UUID REFERENCES shop_users(id) ON DELETE SET NULL,
  ADD COLUMN invited_at TIMESTAMPTZ;

-- Back-fill: existing owner rows get invited_at = created_at
UPDATE shop_users SET invited_at = created_at WHERE invited_at IS NULL;
