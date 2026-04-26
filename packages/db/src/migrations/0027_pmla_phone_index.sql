-- Migration 0027: Partial index for phone-only PMLA monthly lookups
-- Story 5.5 — added after Codex review
--
-- The monthly SUM query in trackPmlaCumulative uses:
--   WHERE aggregate_month = $1
--     AND (customer_id IS NOT DISTINCT FROM $2::uuid)
--     AND (customer_phone IS NOT DISTINCT FROM $3)
--
-- For registered customers (customer_id IS NOT NULL), the existing
-- idx_pmla_aggregates_monthly (shop_id, aggregate_month, customer_id) is used.
--
-- For walk-in customers (customer_id IS NULL), that index cannot efficiently
-- filter on customer_phone. This partial index covers the phone-only path.
CREATE INDEX idx_pmla_aggregates_monthly_phone
  ON pmla_aggregates(shop_id, aggregate_month, customer_phone)
  WHERE customer_id IS NULL;
