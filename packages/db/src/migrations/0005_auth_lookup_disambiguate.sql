-- 0005_auth_lookup_disambiguate.sql — replace auth_lookup_user_by_phone to reject
-- ambiguous lookups where the same E.164 phone is provisioned across multiple active shops.
--
-- Background: shop_users has a unique index only on (shop_id, phone), not on phone alone.
-- If the same phone exists in two active shops the original LIMIT 1 silently returns an
-- unpredictable row, creating a potential cross-tenant auth confusion vector.
--
-- This migration replaces the function body using CREATE OR REPLACE so it is safe to apply
-- against databases that already ran 0003_auth_link.sql. The function signature is unchanged;
-- existing GRANT EXECUTE + OWNER assignments from 0003 are preserved.
--
-- Behaviour change: if count(*) > 1, the function returns zero rows (empty result set).
-- AuthService maps zero rows → 403 auth.not_provisioned. A future multi-shop-staff story
-- (Story 2.x+) will extend this to return a tenant-selector step instead.

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
   WHERE su.phone = p_phone AND s.status = 'ACTIVE';

  -- If the phone is associated with multiple active shops, refuse — would be an
  -- ambiguous auth decision. Auth service treats zero rows as "not_provisioned".
  -- Future: when multi-shop staff is supported (Story 2.x+), extend the flow to
  -- return a tenant-selector step before session creation.
  IF v_count > 1 THEN
    RETURN; -- zero rows; AuthService will 403 auth.not_provisioned
  END IF;

  RETURN QUERY
    SELECT su.shop_id, su.id, su.role, su.status, su.firebase_uid
      FROM shop_users su
      JOIN shops s ON s.id = su.shop_id
     WHERE su.phone = p_phone AND s.status = 'ACTIVE'
     LIMIT 1;
END
$$;
