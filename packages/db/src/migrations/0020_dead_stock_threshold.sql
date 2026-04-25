-- 0020_dead_stock_threshold.sql
-- Adds configurable dead stock detection threshold to shop_settings.
-- Default 180 days matches business rule: items unsold for 6 months are considered dead stock.

ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS dead_stock_threshold_days INTEGER NOT NULL DEFAULT 180;
