-- shop_rate_overrides: per-tenant manual gold/silver rate overrides
-- Shopkeeper (OWNER only) can override today's market rate for a specific purity.
-- RLS enforces tenant isolation — rows only visible to the owning shop.

CREATE TABLE shop_rate_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  purity TEXT NOT NULL CHECK (purity IN (
    'GOLD_24K','GOLD_22K','GOLD_20K','GOLD_18K','GOLD_14K','SILVER_999','SILVER_925'
  )),
  override_paise BIGINT NOT NULL CHECK (override_paise > 0),
  reason TEXT NOT NULL,
  set_by_user_id UUID NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shop_rate_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_rate_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY shop_rate_overrides_tenant_isolation ON shop_rate_overrides
  USING (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT ON shop_rate_overrides TO app_user;

-- Partial index on now() not possible (STABLE, not IMMUTABLE); use full index + WHERE in queries
CREATE INDEX idx_shop_rate_overrides_active
  ON shop_rate_overrides(shop_id, purity, valid_until DESC);
