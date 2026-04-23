-- 0013_shops_revoke_app_user_write.sql
-- The `shops` table is platform-global (SELECT only, no RLS) for reads, but
-- shopkeepers must be able to UPDATE their own shop row (profile updates).
-- To prevent cross-tenant UPDATE leakage we enable RLS on shops for UPDATE
-- only: app_user may only UPDATE the row whose id matches app.current_shop_id.
--
-- INSERT and DELETE remain superuser/platform_admin only.
-- SELECT remains unrestricted (platform-global read is intentional — auth
-- lookups need to read all shops).

-- Grant UPDATE on shops to app_user (needed for shopkeeper profile edits).
GRANT UPDATE ON shops TO app_user;

-- Enable RLS on shops and force it even for table owners.
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops FORCE ROW LEVEL SECURITY;

-- SELECT: platform-global — app_user can read any shop (auth lookups).
DROP POLICY IF EXISTS rls_shops_select ON shops;
CREATE POLICY rls_shops_select ON shops
  FOR SELECT
  USING (true);

-- UPDATE: tenant-scoped — app_user may only UPDATE its own shop row.
DROP POLICY IF EXISTS rls_shops_update ON shops;
CREATE POLICY rls_shops_update ON shops
  FOR UPDATE
  USING (id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (id = current_setting('app.current_shop_id', true)::uuid);
