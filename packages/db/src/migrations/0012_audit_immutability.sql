-- Story 1.6: Make audit_events append-only
-- 0002_grants.sql already revokes UPDATE/DELETE/TRUNCATE from app_user (invariant 11).
-- This migration adds Layer 2: a SECURITY DEFINER trigger that raises an exception
-- for any UPDATE or DELETE, catching even superuser and migration-role attempts.

-- Layer 1: re-assert revocation for defensive completeness (idempotent — already in 0002)
REVOKE UPDATE, DELETE ON audit_events FROM app_user;

-- Layer 2: SECURITY DEFINER trigger — fires regardless of the calling role
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only — write via auditLog() only'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER audit_events_immutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
