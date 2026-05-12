-- 0060_security_definer_schema_resolution.sql
-- Harden pre-auth SECURITY DEFINER functions so app_user calls resolve platform
-- tables consistently even when role/schema privileges or search_path differ.

GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA public TO platform_admin;

CREATE OR REPLACE FUNCTION public.auth_lookup_user_by_phone(p_phone TEXT)
RETURNS TABLE(
  shop_id UUID, user_id UUID, role shop_user_role,
  status shop_user_status, firebase_uid TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.shop_users su
    JOIN public.shops s ON s.id = su.shop_id
   WHERE su.phone = p_phone
     AND s.status = 'ACTIVE'
     AND su.status != 'REVOKED';

  IF v_count > 1 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT su.shop_id, su.id, su.role, su.status, su.firebase_uid
      FROM public.shop_users su
      JOIN public.shops s ON s.id = su.shop_id
     WHERE su.phone = p_phone
       AND s.status = 'ACTIVE'
       AND su.status != 'REVOKED'
     LIMIT 1;
END
$$;
REVOKE ALL ON FUNCTION public.auth_lookup_user_by_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_lookup_user_by_phone(TEXT) TO app_user;
ALTER FUNCTION public.auth_lookup_user_by_phone(TEXT) OWNER TO platform_admin;

CREATE OR REPLACE FUNCTION public.tenant_boot_lookup(p_slug TEXT)
RETURNS TABLE(id UUID, display_name TEXT, config JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
    SELECT s.id, s.display_name, COALESCE(s.config, '{}'::jsonb)
      FROM public.shops s
     WHERE s.slug = p_slug AND s.status = 'ACTIVE'
     LIMIT 1;
END
$$;
REVOKE ALL ON FUNCTION public.tenant_boot_lookup(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_boot_lookup(TEXT) TO app_user;
ALTER FUNCTION public.tenant_boot_lookup(TEXT) OWNER TO platform_admin;
