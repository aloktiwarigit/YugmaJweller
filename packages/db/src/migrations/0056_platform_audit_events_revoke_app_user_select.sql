-- 0056_platform_audit_events_revoke_app_user_select.sql
-- Wave 6 added impersonation audit rows (platform admin UID, target shop, IP/UA, free-form
-- reason) to platform_audit_events. Migration 0003 granted SELECT on this table to app_user
-- for early auth-flow visibility, but the new rows leak cross-tenant info (which platform
-- admin is debugging which shop, with what reason). app_user has no business reading these.
--
-- INSERT remains granted because the strategy + audit logger run under app_user and write
-- pre-auth audit rows. Reads happen only from platform_admin (admin console) and from
-- migrator-role test fixtures.

REVOKE SELECT ON platform_audit_events FROM app_user;
