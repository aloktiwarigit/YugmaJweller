-- 0008_role_permissions.sql
-- Dynamic per-role permission matrix. shop_admin is NOT seeded — PolicyGuard bypasses DB for admin.
CREATE TABLE role_permissions (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID           NOT NULL REFERENCES shops(id),
  role           shop_user_role NOT NULL,
  permission_key TEXT           NOT NULL,
  is_enabled     BOOLEAN        NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE(shop_id, role, permission_key)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_role_permissions_tenant_isolation ON role_permissions
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON role_permissions TO app_user;

-- Seed shop_manager defaults for all existing shops
INSERT INTO role_permissions (shop_id, role, permission_key, is_enabled)
SELECT s.id, 'shop_manager', k.key, k.enabled
FROM shops s
CROSS JOIN (VALUES
  ('billing.create',  true),
  ('billing.void',    false),
  ('inventory.edit',  false),
  ('settings.edit',   false),
  ('reports.view',    true),
  ('analytics.view',  true)
) AS k(key, enabled)
ON CONFLICT (shop_id, role, permission_key) DO NOTHING;

-- Seed shop_staff defaults for all existing shops
INSERT INTO role_permissions (shop_id, role, permission_key, is_enabled)
SELECT s.id, 'shop_staff', k.key, k.enabled
FROM shops s
CROSS JOIN (VALUES
  ('billing.create',  true),
  ('billing.void',    false),
  ('inventory.edit',  false),
  ('settings.edit',   false),
  ('reports.view',    false),
  ('analytics.view',  false)
) AS k(key, enabled)
ON CONFLICT (shop_id, role, permission_key) DO NOTHING;
