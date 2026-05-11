-- 0060_products_cost_paise.sql
-- Adds cost_paise to products for stock-aging totalCostPaise aggregation (FR117).
-- NULL = cost not recorded (legacy rows); aggregation skips nulls.
-- BIGINT supports values up to ~9.2 × 10^18 paise (₹9.2 × 10^16) — far beyond
-- realistic per-product cost; matches the precision rule in CLAUDE.md (no FLOAT for money).

ALTER TABLE products
  ADD COLUMN cost_paise BIGINT;
