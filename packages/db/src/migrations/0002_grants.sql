-- 0002_grants.sql — privilege grants. Order: roles (0000) → tables (0001) → grants (here).

-- app_user: DML on tenant tables, no DDL
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON shop_users TO app_user;
GRANT SELECT                         ON shops      TO app_user;

-- audit_events: append-only for app_user (invariant 11)
GRANT INSERT, SELECT ON audit_events TO app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM app_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- migrator: DDL only, zero DML on tenant tables (invariant 5)
-- NOTE: `migrator` role is created by infra, not by migration 0000. If it does not exist locally,
-- grants against it fail. For MVP (no real cloud infra yet per ADR-0015), migrator grants are
-- guarded so local dev does not fail.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrator') THEN
    GRANT USAGE, CREATE ON SCHEMA public TO migrator;
    REVOKE ALL ON shops        FROM migrator;
    REVOKE ALL ON shop_users   FROM migrator;
    REVOKE ALL ON audit_events FROM migrator;
  END IF;
END$$;

-- platform_admin: broad access for SECURITY DEFINER functions (used in Story 1.5+)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_admin;

-- Default privileges so future tables automatically flow to app_user via migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
