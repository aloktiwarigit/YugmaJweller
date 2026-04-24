-- 0019_sync_infrastructure.sql
-- Creates tenant_sync_cursors (PK-scoped, NO RLS) and sync_change_log (RLS-enforced)
-- for offline sync protocol (ADR-0004). Append-only change log per tenant.

-- 1. Per-tenant cursor tracking (global table, PK-scoped, NO RLS)
CREATE TABLE tenant_sync_cursors (
  shop_id    UUID PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  cursor     BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON tenant_sync_cursors TO app_user;

-- 2. Append-only change log (tenant-scoped, RLS enforced)
CREATE TABLE sync_change_log (
  id         BIGSERIAL PRIMARY KEY,
  shop_id    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  seq        BIGINT NOT NULL,
  table_name TEXT NOT NULL,
  operation  TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  row_id     TEXT NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON sync_change_log TO app_user;
GRANT USAGE, SELECT ON SEQUENCE sync_change_log_id_seq TO app_user;

-- Index for efficient cursor-based pulls per tenant
CREATE INDEX idx_sync_change_log_shop_seq ON sync_change_log (shop_id, seq);

-- RLS — same pattern as audit_events
ALTER TABLE sync_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_change_log FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_sync_change_log_tenant_isolation ON sync_change_log
  FOR ALL
  USING  (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

-- 3. Seed a cursor row for all existing shops
INSERT INTO tenant_sync_cursors (shop_id, cursor)
SELECT id, 0 FROM shops
ON CONFLICT (shop_id) DO NOTHING;
