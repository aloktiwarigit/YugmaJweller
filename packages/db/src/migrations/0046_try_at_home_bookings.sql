-- 0046_try_at_home_bookings.sql
-- Try-at-home booking lifecycle: REQUESTED → DISPATCHED → RETURNED | CONVERTED_TO_SALE | EXPIRED
-- Product status is managed via InventoryService (IN_TRY_AT_HOME state added in story-3C).

BEGIN;

CREATE TABLE try_at_home_bookings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID        NOT NULL REFERENCES shops(id),
  customer_id     UUID        NOT NULL REFERENCES customers(id),
  product_ids     UUID[]      NOT NULL DEFAULT '{}',
  status          TEXT        NOT NULL DEFAULT 'REQUESTED'
                    CHECK (status IN (
                      'REQUESTED', 'DISPATCHED', 'RETURNED', 'CONVERTED_TO_SALE', 'EXPIRED'
                    )),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispatch_at     TIMESTAMPTZ,
  return_due_at   TIMESTAMPTZ,
  notes           TEXT
);

-- Tenancy: every row is shop-scoped
ALTER TABLE try_at_home_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE try_at_home_bookings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_try_at_home_bookings_tenant_isolation ON try_at_home_bookings;
CREATE POLICY rls_try_at_home_bookings_tenant_isolation ON try_at_home_bookings
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

REVOKE ALL ON try_at_home_bookings FROM app_user;
GRANT SELECT, INSERT, UPDATE ON try_at_home_bookings TO app_user;

CREATE INDEX idx_try_at_home_bookings_shop_status
  ON try_at_home_bookings(shop_id, status, requested_at DESC);

CREATE INDEX idx_try_at_home_bookings_customer
  ON try_at_home_bookings(shop_id, customer_id);

COMMIT;
