-- 0011_firebase_uid_index_exclude_revoked.sql — relax firebase_uid uniqueness for REVOKED rows
--
-- The global unique index (firebase_uid IS NOT NULL) was created in migration 0003 to prevent
-- a single Firebase account from being associated with multiple shop memberships. Story 1.5
-- introduces a cross-shop scenario: a user revoked from shop A should be able to join (and link
-- their Firebase UID to) shop B. With the original index, the REVOKED row in shop A holds the
-- UID and causes a unique-constraint violation when linkFirebaseUid runs for shop B.
--
-- Fix: drop and recreate the index excluding rows where status = 'REVOKED'. REVOKED rows keep
-- their firebase_uid column value (useful for audit and post-revoke token cleanup), but no
-- longer participate in the uniqueness constraint.

DROP INDEX IF EXISTS shop_users_firebase_uid_uq;

CREATE UNIQUE INDEX shop_users_firebase_uid_uq
  ON shop_users (firebase_uid)
  WHERE firebase_uid IS NOT NULL AND status != 'REVOKED';
