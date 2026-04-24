-- Fix RLS policy on shop_rate_overrides: add WITH CHECK + FOR ALL + naming convention.
-- Migration 0017 created the table but omitted WITH CHECK, causing tenant-isolation CI failure.

DROP POLICY IF EXISTS shop_rate_overrides_tenant_isolation ON shop_rate_overrides;

CREATE POLICY rls_shop_rate_overrides_tenant_isolation ON shop_rate_overrides
  FOR ALL
  USING  (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);
