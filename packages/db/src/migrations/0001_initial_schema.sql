-- 0001_initial_schema.sql
-- Creates shops, shop_users, audit_events + RLS policies.
-- Codegen'd RLS from generate-rls.ts is appended manually below the DDL.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE shop_status        AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');
CREATE TYPE shop_user_status   AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE shop_user_role     AS ENUM ('shop_admin', 'shop_manager', 'shop_staff');

-- shops (platform-global; NO RLS)
CREATE TABLE shops (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  status        shop_status NOT NULL DEFAULT 'PROVISIONING',
  kek_key_arn   TEXT,
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- shop_users (tenant-scoped; RLS enabled below)
CREATE TABLE shop_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  phone         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          shop_user_role NOT NULL,
  status        shop_user_status NOT NULL DEFAULT 'INVITED',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shop_users_shop_id_idx ON shop_users (shop_id);
CREATE UNIQUE INDEX shop_users_shop_id_phone_idx ON shop_users (shop_id, phone);

-- audit_events (tenant-scoped, append-only; RLS enabled + DML locked down in 0002)
CREATE TABLE audit_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  actor_user_id  UUID,
  action         TEXT NOT NULL,
  subject_type   TEXT NOT NULL,
  subject_id     TEXT,
  before         JSONB,
  after          JSONB,
  metadata       JSONB,
  ip             TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_shop_id_created_idx ON audit_events (shop_id, created_at DESC);

-- RLS policies (self-contained here for review; equivalent output from generate-rls.ts).
ALTER TABLE shop_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_shop_users_tenant_isolation ON shop_users;
CREATE POLICY rls_shop_users_tenant_isolation ON shop_users
  FOR ALL
  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_audit_events_tenant_isolation ON audit_events;
CREATE POLICY rls_audit_events_tenant_isolation ON audit_events
  FOR ALL
  USING (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);
