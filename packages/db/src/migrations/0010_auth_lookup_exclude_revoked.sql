-- 0010_auth_lookup_exclude_revoked.sql — exclude REVOKED memberships from phone lookup
--
-- Story 1.5 introduced staff revocation. The existing ambiguity check in
-- auth_lookup_user_by_phone counts ALL shop_users rows for a phone number,
-- including REVOKED ones. This means: if a user is revoked from shop A but
-- remains ACTIVE/INVITED in shop B, the count becomes > 1 and the function
-- returns zero rows — locking out the valid shop B user with auth.not_provisioned.
--
-- Fix: add AND su.status != 'REVOKED' to both the ambiguity count and the
-- RETURN QUERY so revoked memberships are invisible to phone-based auth.

CREATE OR REPLACE FUNCTION auth_lookup_user_by_phone(p_phone TEXT)
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
    FROM shop_users su
    JOIN shops s ON s.id = su.shop_id
   WHERE su.phone = p_phone
     AND s.status = 'ACTIVE'
     AND su.status != 'REVOKED';

  IF v_count > 1 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT su.shop_id, su.id, su.role, su.status, su.firebase_uid
      FROM shop_users su
      JOIN shops s ON s.id = su.shop_id
     WHERE su.phone = p_phone
       AND s.status = 'ACTIVE'
       AND su.status != 'REVOKED'
     LIMIT 1;
END
$$;
