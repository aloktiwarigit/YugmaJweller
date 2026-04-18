-- 0003_auth_link.sql — links shop_users to Firebase UIDs + rate-limit + pre-tenant audit.
-- Applied AFTER 0002_grants.sql and BEFORE 0004_rls_fail_loud.sql.
--
-- platform_admin needs BYPASSRLS for SECURITY DEFINER pre-auth fns (no tenant ctx yet).
-- shop_users + audit_events enforce FORCE ROW LEVEL SECURITY, which applies even to the
-- table owner. SECURITY DEFINER functions owned by platform_admin therefore must bypass
-- RLS to perform the phone → user lookup at /auth/session (pre-tenant-resolution).
-- Scope: platform_admin is NEVER used for general DML — only as the definer role for
-- the two restricted functions below. Caller authorization is enforced by the function
-- bodies (status filter + LIMIT 1) and by GRANT EXECUTE being limited to app_user.
ALTER ROLE platform_admin BYPASSRLS;

-- Extend shop_users
ALTER TABLE shop_users ADD COLUMN firebase_uid TEXT;
ALTER TABLE shop_users ADD COLUMN activated_at TIMESTAMPTZ;
CREATE UNIQUE INDEX shop_users_firebase_uid_uq
  ON shop_users (firebase_uid) WHERE firebase_uid IS NOT NULL;

-- auth_rate_limits: platform-global, pre-tenant-resolution
CREATE TABLE auth_rate_limits (
  phone_e164         TEXT PRIMARY KEY,
  verify_failures    INT NOT NULL DEFAULT 0,
  window_started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until       TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_rate_limits TO app_user;

-- platform_audit_events: platform-global, append-only, pre-tenant-resolution
CREATE TABLE platform_audit_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action       TEXT NOT NULL,
  ip_address   INET,
  user_agent   TEXT,
  request_id   TEXT,
  phone_hash   TEXT,                         -- SHA-256(phone_e164); NEVER raw phone
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX platform_audit_events_action_created_at_idx
  ON platform_audit_events (action, created_at DESC);
GRANT INSERT, SELECT ON platform_audit_events TO app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON platform_audit_events FROM app_user;

-- SECURITY DEFINER: phone → user/tenant lookup (pre-auth, no tenant ctx).
-- Runs as platform_admin (BYPASSRLS) — RLS does not apply; caller authorization is
-- enforced by the status filter + LIMIT 1 + the restricted GRANT EXECUTE to app_user.
CREATE OR REPLACE FUNCTION auth_lookup_user_by_phone(p_phone TEXT)
RETURNS TABLE(
  shop_id UUID, user_id UUID, role shop_user_role,
  status shop_user_status, firebase_uid TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
    SELECT su.shop_id, su.id, su.role, su.status, su.firebase_uid
      FROM shop_users su
      JOIN shops s ON s.id = su.shop_id
     WHERE su.phone = p_phone AND s.status = 'ACTIVE'
     LIMIT 1;
END
$$;
REVOKE ALL ON FUNCTION auth_lookup_user_by_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_phone(TEXT) TO app_user;
ALTER FUNCTION auth_lookup_user_by_phone(TEXT) OWNER TO platform_admin;

-- SECURITY DEFINER: slug → tenant config lookup (pre-auth, brand bootstrap).
-- Runs as platform_admin (BYPASSRLS). shops is platform-global (no RLS) so BYPASSRLS
-- is not strictly required here, but we keep the owner consistent with the paired fn.
CREATE OR REPLACE FUNCTION tenant_boot_lookup(p_slug TEXT)
RETURNS TABLE(id UUID, display_name TEXT, config JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
    SELECT s.id, s.display_name, s.config
      FROM shops s
     WHERE s.slug = p_slug AND s.status = 'ACTIVE'
     LIMIT 1;
END
$$;
REVOKE ALL ON FUNCTION tenant_boot_lookup(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_boot_lookup(TEXT) TO app_user;
ALTER FUNCTION tenant_boot_lookup(TEXT) OWNER TO platform_admin;
