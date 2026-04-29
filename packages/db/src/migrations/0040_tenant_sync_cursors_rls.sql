-- RLS was missing from tenant_sync_cursors. App layer scoped correctly via shop_id
-- but no DB-level enforcement existed. This adds defence-in-depth.
ALTER TABLE tenant_sync_cursors ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_sync_cursors_isolation ON tenant_sync_cursors
  USING (shop_id = current_setting('app.current_shop_id', TRUE)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::uuid);
