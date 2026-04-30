-- 0044_custom_orders.sql
-- Custom orders lifecycle: QUOTE → DEPOSIT_PENDING → IN_PROGRESS → READY → DELIVERED / CANCELLED
-- custom_orders: one row per bespoke commission.
-- custom_order_milestones: append-only work-in-progress log (photo + note).
-- Section 269SS enforced at service layer for cash deposits ≥ Rs 20,000.

BEGIN;

-- ============================================================================
-- 1. custom_orders
-- ============================================================================

CREATE TABLE custom_orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                 UUID NOT NULL REFERENCES shops(id),
  customer_id             UUID REFERENCES customers(id),
  description             TEXT NOT NULL CHECK (length(description) >= 1),
  design_reference_url    TEXT,
  quoted_amount_paise     BIGINT CHECK (quoted_amount_paise IS NULL OR quoted_amount_paise >= 0),
  deposit_amount_paise    BIGINT NOT NULL DEFAULT 0 CHECK (deposit_amount_paise >= 0),
  deposit_paid_paise      BIGINT NOT NULL DEFAULT 0 CHECK (deposit_paid_paise >= 0),
  razorpay_order_id       TEXT,
  razorpay_payment_id     TEXT,
  status                  TEXT NOT NULL DEFAULT 'QUOTE'
                            CHECK (status IN (
                              'QUOTE','DEPOSIT_PENDING','IN_PROGRESS','READY','DELIVERED','CANCELLED'
                            )),
  estimated_delivery_date DATE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenancy: every row is shop-scoped
ALTER TABLE custom_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_custom_orders_tenant_isolation ON custom_orders;
CREATE POLICY rls_custom_orders_tenant_isolation ON custom_orders
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

-- Grants: full CRUD for app_user (milestones may not be deleted; orders are soft-cancelled)
REVOKE ALL ON custom_orders FROM app_user;
GRANT SELECT, INSERT, UPDATE ON custom_orders TO app_user;

-- Indexes
CREATE INDEX idx_custom_orders_shop_status
  ON custom_orders(shop_id, status, created_at DESC);

CREATE INDEX idx_custom_orders_customer
  ON custom_orders(shop_id, customer_id)
  WHERE customer_id IS NOT NULL;

-- ============================================================================
-- 2. custom_order_milestones — append-only work log
-- ============================================================================

CREATE TABLE custom_order_milestones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_order_id  UUID NOT NULL REFERENCES custom_orders(id),
  shop_id          UUID NOT NULL REFERENCES shops(id),
  title            TEXT NOT NULL CHECK (length(title) >= 1),
  note             TEXT,
  photo_url        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE custom_order_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_order_milestones FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_custom_order_milestones_tenant_isolation ON custom_order_milestones;
CREATE POLICY rls_custom_order_milestones_tenant_isolation ON custom_order_milestones
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

-- Milestones are append-only: INSERT + SELECT only for app_user.
REVOKE ALL ON custom_order_milestones FROM app_user;
GRANT SELECT, INSERT ON custom_order_milestones TO app_user;

CREATE INDEX idx_custom_order_milestones_order
  ON custom_order_milestones(shop_id, custom_order_id, created_at DESC);

COMMIT;
