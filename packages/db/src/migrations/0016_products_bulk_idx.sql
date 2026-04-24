-- 0016_products_bulk_idx.sql
-- Optimize per-tenant product listing by created_at (used heavily after bulk import).
CREATE INDEX IF NOT EXISTS idx_products_shop_created
  ON products(shop_id, created_at DESC);
