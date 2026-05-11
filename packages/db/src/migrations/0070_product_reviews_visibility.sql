-- 0070_product_reviews_visibility.sql
-- Add is_publicly_visible BOOLEAN to product_reviews.
--
-- DPDPA NOTE: Default is TRUE (opt-out model, not opt-in).
-- All rows in this table were publicly visible before this migration — the original
-- table (migration 0047) had no visibility control. Backfilling to FALSE would silently
-- hide reviews customers expected to be public. TRUE preserves the existing contract.
-- Customer opt-out and shopkeeper moderation endpoints land in Phase B (Story B4),
-- which also adds GRANT UPDATE on this column to app_user. No UPDATE grant here.
--
-- Index strategy:
--   idx_product_reviews_product (no predicate, migration 0047) — kept; serves
--     the shopkeeper's private per-product review list.
--   idx_product_reviews_public (partial, below) — new; serves the Phase B public
--     reviews endpoint. Adding alongside avoids breaking the shopkeeper read path.
--
-- GRANT: original grants are SELECT, INSERT only (migration 0047). Customers submit
-- reviews; shopkeeper opt-out/moderation lands in Phase B as a separate endpoint.
-- No new grant in this migration.

ALTER TABLE product_reviews
  ADD COLUMN is_publicly_visible BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN product_reviews.is_publicly_visible IS
  'TRUE = display on public PDP reviews section. Default TRUE (opt-out model, DPDPA-aware). '
  'Customer/shopkeeper opt-out via Phase B Story B4 endpoint.';

CREATE INDEX idx_product_reviews_public
  ON product_reviews(shop_id, product_id, created_at DESC)
  WHERE is_publicly_visible = TRUE;
