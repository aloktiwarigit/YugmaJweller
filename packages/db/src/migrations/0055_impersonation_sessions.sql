-- 0055_impersonation_sessions.sql
-- Time-bounded support sessions where a platform_admin acts as a tenant.
-- expires_at is enforced at JWT verification AND at every interceptor lookup (defense in depth).

CREATE TABLE impersonation_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id    TEXT NOT NULL,
  target_shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  ended_at            TIMESTAMPTZ,
  reason              TEXT NOT NULL,
  ip_address          INET,
  user_agent          TEXT,
  CONSTRAINT impersonation_sessions_reason_nonempty CHECK (length(btrim(reason)) > 0),
  CONSTRAINT impersonation_sessions_expires_after_start CHECK (expires_at > started_at)
);

CREATE INDEX impersonation_sessions_target_shop_idx
  ON impersonation_sessions (target_shop_id, started_at DESC);
CREATE INDEX impersonation_sessions_platform_user_idx
  ON impersonation_sessions (platform_user_id, started_at DESC);
-- Hot lookup: "is this session still active?"
CREATE INDEX impersonation_sessions_active_idx
  ON impersonation_sessions (id) WHERE ended_at IS NULL;

REVOKE ALL ON impersonation_sessions FROM PUBLIC;
REVOKE ALL ON impersonation_sessions FROM app_user;
GRANT  SELECT, INSERT, UPDATE ON impersonation_sessions TO platform_admin;
