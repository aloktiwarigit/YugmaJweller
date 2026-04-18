-- 0000_roles.sql — DB roles (created before tables, no grants yet)
-- Applied by the `migrator` role. Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'placeholder_app_user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_admin') THEN
    CREATE ROLE platform_admin NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'placeholder_platform_admin';
  END IF;
END$$;

-- Migrator role is created by infra Terraform (not here) because the migrator is the role that
-- runs migrations — bootstrapping it inside a migration is circular. This file documents the
-- expectation: `migrator` exists as NOSUPERUSER NOBYPASSRLS with DDL grants only.

-- Real passwords injected via secrets in deploy; local dev uses docker-compose defaults.
