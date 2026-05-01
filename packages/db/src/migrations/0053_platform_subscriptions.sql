-- 0053_platform_subscriptions.sql
-- Per-tenant subscription state. Platform-global table; never tenant-scoped reads.
-- Only platform_admin operates on this table — app_user has NO grants.

CREATE TABLE platform_subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id              UUID NOT NULL UNIQUE REFERENCES shops(id) ON DELETE RESTRICT,
  plan                 TEXT NOT NULL DEFAULT 'trial'
                         CHECK (plan IN ('trial','starter','growth','enterprise')),
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','suspended','cancelled')),
  billing_cycle_start  DATE,
  mrr_paise            BIGINT NOT NULL DEFAULT 0 CHECK (mrr_paise >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX platform_subscriptions_status_idx ON platform_subscriptions (status);

REVOKE ALL ON platform_subscriptions FROM PUBLIC;
REVOKE ALL ON platform_subscriptions FROM app_user;
GRANT  SELECT, INSERT, UPDATE ON platform_subscriptions TO platform_admin;
