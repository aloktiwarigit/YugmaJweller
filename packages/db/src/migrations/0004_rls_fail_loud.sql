-- 0004_rls_fail_loud.sql — close E2-S1 deferral: drop missok=true from RLS
-- After this migration, a query that reaches the DB without `SET LOCAL
-- app.current_shop_id` AND without the pool's poison-default raises
-- "42704 unrecognized configuration parameter app.current_shop_id" rather than
-- silently returning zero rows. Pair with packages/db/src/codegen/generate-rls.ts
-- update so future tenantScopedTable usages emit this form automatically.

DROP POLICY rls_shop_users_tenant_isolation ON shop_users;
DROP POLICY rls_audit_events_tenant_isolation ON audit_events;

CREATE POLICY rls_shop_users_tenant_isolation ON shop_users
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

CREATE POLICY rls_audit_events_tenant_isolation ON audit_events
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);
