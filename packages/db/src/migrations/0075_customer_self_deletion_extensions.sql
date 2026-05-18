-- 0075_customer_self_deletion_extensions.sql
--
-- Story 19.7 — extends 0036 DPDPA deletion to four tables added after 6.8 shipped:
--   wishlists, product_reviews, rate_lock_bookings, try_at_home_bookings.
--
-- The hard-delete in 0036's worker currently fails FK constraints whenever
-- a customer has any of these rows. This migration unblocks it AND adds the
-- columns needed for the customer-self reason picker shipping with 19.7.
--
-- Decisions documented in:
--   docs/superpowers/specs/2026-05-17-story-19.7-dpdpa-customer-self-deletion-design.md
--
-- What this migration does:
--   1. Add deletion_reason + deletion_reason_text columns to customers
--      (customer-supplied reason captured at soft-delete; reasonText is
--      kept ONLY in this column, never in audit-log payloads).
--   2. Make product_reviews.customer_id NULLABLE with FK ON DELETE SET NULL
--      so reviews outlive their author (anonymisation pattern).
--   3. Add 'CANCELLED' to try_at_home_bookings.status enum.
--   4. Make rate_lock_bookings.customer_id NULLABLE + FK ON DELETE SET NULL
--      so hardDeleteAtomic can DELETE the customer row at day 30 without
--      FK-violation; booking row remains for shopkeeper audit trail.
--   5. Same NULLABLE + ON DELETE SET NULL for try_at_home_bookings.
--
-- Wishlists need no schema change — soft-delete issues an explicit DELETE
-- (DELETE is granted to app_user in 0047). UPDATE on product_reviews is
-- already granted to app_user via 0059_reviews_wishlist_update_grant.sql.
--
-- RLS policies on all four tables remain unchanged — they all already filter
-- on shop_id = current_setting('app.current_shop_id', true)::uuid, and the
-- new cascade SQL runs inside the existing withTenantTx wrapper.

BEGIN;

-- 1. customers: deletion_reason + deletion_reason_text
ALTER TABLE customers ADD COLUMN deletion_reason TEXT
  CHECK (deletion_reason IS NULL OR deletion_reason IN
    ('no-need','privacy','other-jeweller','other'));

ALTER TABLE customers ADD COLUMN deletion_reason_text TEXT
  CHECK (deletion_reason_text IS NULL OR length(deletion_reason_text) <= 200);

-- 2. product_reviews: customer_id NULLABLE + FK SET NULL
ALTER TABLE product_reviews ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE product_reviews DROP CONSTRAINT product_reviews_customer_id_fkey;
ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- NOTE: uq_review_customer_product (UNIQUE shop_id, customer_id, product_id from
-- 0047) remains intact. PostgreSQL treats NULL as distinct in unique constraints,
-- so multiple anonymised rows (customer_id IS NULL) for the same (shop_id,
-- product_id) are permitted — this is the intended anonymisation behaviour
-- after customer hard-delete. No constraint change needed.

-- 3. try_at_home_bookings: add CANCELLED status
ALTER TABLE try_at_home_bookings DROP CONSTRAINT try_at_home_bookings_status_check;
ALTER TABLE try_at_home_bookings ADD CONSTRAINT try_at_home_bookings_status_check
  CHECK (status IN ('REQUESTED','DISPATCHED','RETURNED','CONVERTED_TO_SALE','EXPIRED','CANCELLED'));

-- 4. rate_lock_bookings: detach customer_id at hard-delete time.
ALTER TABLE rate_lock_bookings ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE rate_lock_bookings DROP CONSTRAINT rate_lock_bookings_customer_id_fkey;
ALTER TABLE rate_lock_bookings ADD CONSTRAINT rate_lock_bookings_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 5. try_at_home_bookings: same detach behavior on customer_id.
ALTER TABLE try_at_home_bookings ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE try_at_home_bookings DROP CONSTRAINT try_at_home_bookings_customer_id_fkey;
ALTER TABLE try_at_home_bookings ADD CONSTRAINT try_at_home_bookings_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 6. Backfill for already-soft-deleted customers (pre-19.7 deletions). These
--    rows never ran the new cascade, so they have orphaned children that the
--    new FK SET NULL would silently leave dangling (and DISPATCHED try-at-home
--    would lose its customer link, blocking physical recovery).
--
--    Order:
--    a) FAIL the migration if any soft-deleted customer has a DISPATCHED
--       try-at-home — the shopkeeper must recover the piece before we can
--       finish the deletion. Operator sees a clear NOTICE.
--    b) Hard-delete wishlists (ephemeral, no audit value).
--    c) Cancel ACTIVE / PENDING_PAYMENT rate-lock bookings — they can no
--       longer be honored.
--    d) Cancel REQUESTED try-at-home bookings — same reasoning.

DO $$
DECLARE
  dispatched_count INT;
BEGIN
  SELECT COUNT(*) INTO dispatched_count
    FROM try_at_home_bookings t
    JOIN customers c ON c.id = t.customer_id
   WHERE c.deleted_at IS NOT NULL
     AND t.status = 'DISPATCHED';

  IF dispatched_count > 0 THEN
    RAISE EXCEPTION
      '0075 backfill: % soft-deleted customer(s) have DISPATCHED try-at-home bookings — recover the pieces first',
      dispatched_count;
  END IF;
END $$;

DELETE FROM wishlists w
 USING customers c
 WHERE w.customer_id = c.id
   AND c.deleted_at IS NOT NULL;

UPDATE rate_lock_bookings rlb
   SET status = 'CANCELLED'
  FROM customers c
 WHERE rlb.customer_id = c.id
   AND c.deleted_at IS NOT NULL
   AND rlb.status IN ('PENDING_PAYMENT','ACTIVE');

UPDATE try_at_home_bookings tah
   SET status = 'CANCELLED'
  FROM customers c
 WHERE tah.customer_id = c.id
   AND c.deleted_at IS NOT NULL
   AND tah.status = 'REQUESTED';

COMMIT;
