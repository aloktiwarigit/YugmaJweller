-- Story 6.8: DPDPA-compliant customer deletion (soft-delete day 0 + hard-delete day 30).
--
-- Why this exists:
--   DPDPA right to erasure (data principal) vs PMLA 5-year retention (regulator).
--   Resolution: PII is scrubbed immediately on request (DPDPA honoured day 0). The
--   row shell + a 30-day grace window is retained only so audit trails point to a
--   stable id. After 30 days the row is fully removed and any retained invoices
--   keep their tax/HUID/GST data while customer_id is set to NULL.
--
-- What this migration does:
--   1. Add deletion-state columns to customers.
--   2. Add a DELETE RLS policy + GRANT so the BullMQ worker can hard-delete inside
--      a tenant transaction. Existing GRANTs only covered SELECT/INSERT/UPDATE.
--   3. Index the hard-delete queue for the daily safety-net sweep.
--
-- Note: invoices.customer_id is already NULLABLE since 0022_billing.sql so no
-- ALTER is needed there.

BEGIN;

ALTER TABLE customers
  ADD COLUMN deleted_at               TIMESTAMPTZ,
  ADD COLUMN hard_delete_scheduled_at TIMESTAMPTZ,
  ADD COLUMN pii_redacted_at          TIMESTAMPTZ,
  ADD COLUMN deletion_requested_by    TEXT
    CHECK (deletion_requested_by IS NULL OR deletion_requested_by IN ('customer','owner'));

-- Allow the worker (running as app_user with tenant context) to hard-delete the
-- soft-deleted row after the grace window expires.
DROP POLICY IF EXISTS customers_tenant_delete ON customers;
CREATE POLICY customers_tenant_delete ON customers
  FOR DELETE
  USING (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT DELETE ON customers TO app_user;

-- Hot-path index for the daily sweep that finds customers whose grace window
-- elapsed (catches jobs lost to Redis restarts).
CREATE INDEX idx_customers_hard_delete_queue
  ON customers(hard_delete_scheduled_at)
  WHERE hard_delete_scheduled_at IS NOT NULL
    AND deleted_at IS NOT NULL;

-- pgcrypto provides digest() for the shop-scoped phone hash used at soft-delete
-- time. Idempotent — safe if already enabled.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

COMMIT;
