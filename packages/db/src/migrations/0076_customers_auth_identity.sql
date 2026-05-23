-- Migration 0076: Multi-provider auth identity
-- Makes phone nullable (OAuth users have no phone number at sign-up).
-- Adds firebase_uid, display_name, auth_provider.
-- email column already exists (migration 0028) — not re-added here.

ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE customers
  ADD COLUMN firebase_uid  TEXT,
  ADD COLUMN display_name  TEXT,
  ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'phone'
    CHECK (auth_provider IN ('phone', 'google', 'email_password'));

-- Partial unique index: two customers in the same shop cannot share a firebase_uid,
-- but multiple NULL values are allowed (existing customers before lazy migration).
CREATE UNIQUE INDEX customers_shop_firebase_uid_idx
  ON customers (shop_id, firebase_uid)
  WHERE firebase_uid IS NOT NULL;

-- Case-insensitive email lookup index (email already exists, adding lookup index).
CREATE INDEX customers_shop_email_idx
  ON customers (shop_id, lower(email))
  WHERE email IS NOT NULL;
