-- 0076_auth_lookup_by_firebase_uid.sql
--
-- OAuth/email shopkeeper login arrives with a Firebase UID but no phone claim.
-- This lookup happens before the request has a tenant context, so raw SELECTs
-- from FORCE RLS tables cannot see shop_users on Cloud SQL. Keep the same
-- pre-auth SECURITY DEFINER pattern used by auth_lookup_user_by_phone.

CREATE OR REPLACE FUNCTION public.auth_lookup_user_by_firebase_uid(p_firebase_uid TEXT)
RETURNS TABLE(
  shop_id UUID, user_id UUID, role shop_user_role,
  status shop_user_status, firebase_uid TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
    SELECT su.shop_id, su.id, su.role, su.status, su.firebase_uid
      FROM public.shop_users su
      JOIN public.shops s ON s.id = su.shop_id
     WHERE su.firebase_uid = p_firebase_uid
       AND s.status = 'ACTIVE'
       AND su.status != 'REVOKED'
     LIMIT 1;
END
$$;

REVOKE ALL ON FUNCTION public.auth_lookup_user_by_firebase_uid(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_lookup_user_by_firebase_uid(TEXT) TO app_user;
ALTER FUNCTION public.auth_lookup_user_by_firebase_uid(TEXT) OWNER TO platform_admin;
