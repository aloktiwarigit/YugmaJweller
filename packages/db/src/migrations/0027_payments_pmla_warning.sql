-- Migration 0027: Store pmla_warning on the payment record for idempotent retry
-- Story 5.5 — enables returning the original pmlaWarning on any retry of the
-- cash-payment endpoint without re-querying the live monthly aggregate.
--
-- Nullable: only set when the payment triggered the Rs 8L PMLA warn threshold.
-- Stored as JSONB so the caller gets the exact same cumulativePaise/monthStr/status
-- that was returned on the first successful response, regardless of subsequent payments.
ALTER TABLE payments ADD COLUMN pmla_warning_jsonb JSONB;

-- Partial index for phone-only PMLA monthly lookups (consolidated from 5.5 Codex)
CREATE INDEX idx_pmla_aggregates_monthly_phone
  ON pmla_aggregates(shop_id, aggregate_month, customer_phone)
  WHERE customer_id IS NULL;
