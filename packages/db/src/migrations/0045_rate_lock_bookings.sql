-- 0045_rate_lock_bookings.sql
-- Rate-lock bookings: customer pays a deposit to freeze today's 24K IBJA rate.
-- Status flow: PENDING_PAYMENT → ACTIVE → USED | EXPIRED | CANCELLED

BEGIN;

CREATE TABLE rate_lock_bookings (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id                         UUID NOT NULL REFERENCES shops(id),
  customer_id                     UUID NOT NULL REFERENCES customers(id),
  locked_rate_24k_paise_per_gram  BIGINT NOT NULL,
  locked_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at                      TIMESTAMPTZ NOT NULL,
  deposit_amount_paise            BIGINT NOT NULL CHECK (deposit_amount_paise > 0),
  deposit_paid_paise              BIGINT NOT NULL DEFAULT 0,
  razorpay_order_id               TEXT,
  razorpay_payment_id             TEXT,
  status                          TEXT NOT NULL DEFAULT 'PENDING_PAYMENT'
    CHECK (status IN ('PENDING_PAYMENT','ACTIVE','USED','EXPIRED','CANCELLED'))
);

-- Tenant isolation
ALTER TABLE rate_lock_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_lock_bookings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_rate_lock_bookings_tenant_isolation ON rate_lock_bookings;
CREATE POLICY rls_rate_lock_bookings_tenant_isolation ON rate_lock_bookings
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

REVOKE ALL ON rate_lock_bookings FROM app_user;
GRANT SELECT, INSERT, UPDATE ON rate_lock_bookings TO app_user;

-- Honor lookup index
CREATE INDEX idx_rate_lock_bookings_honor
  ON rate_lock_bookings (customer_id, shop_id, expires_at)
  WHERE status = 'ACTIVE';

-- Shopkeeper list view index
CREATE INDEX idx_rate_lock_bookings_shop_list
  ON rate_lock_bookings (shop_id, status, locked_at DESC);

-- One active lock per customer+shop
CREATE UNIQUE INDEX uq_rate_lock_bookings_one_active
  ON rate_lock_bookings (customer_id, shop_id)
  WHERE status = 'ACTIVE';

COMMIT;
