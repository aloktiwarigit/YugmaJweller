-- 0074_payment_sessions.sql
-- Durable single-use payment-link sessions. Replaces the in-process Map<string, number>
-- nonce store that lost state on API restart and could not coordinate across Cloud Run
-- instances. Each row is the authoritative server-side record of a payment URL:
--   - generated when the customer requests /customer/rate-lock/bookings/:id/payment-token
--   - consumed atomically on first successful /pay/rate-lock?token=... render
--
-- The jti embedded in the signed token is this row's primary key. Atomic consume:
--
--   UPDATE payment_sessions
--      SET consumed_at = NOW()
--    WHERE id = $jti AND consumed_at IS NULL AND expires_at > NOW()
--    RETURNING id
--
-- 0 rows → replay or expired → 409. >0 rows → safe to render checkout HTML.
--
-- Tenant isolation: RLS on shop_id (current_setting('app.current_shop_id'::uuid)).
-- Tenant FK closure: composite FK (shop_id, customer_id) → customers(shop_id, id)
-- prevents cross-tenant insert via a known customer UUID alone, per the
-- FK-bypasses-RLS lesson called out in feedback_spec_lessons_need_plan_assertions.md.

BEGIN;

-- Required parent UNIQUE to support the composite FK below. Idempotent so reruns
-- against environments that already have it (none today, but defensive) succeed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_shop_id_id_uniq'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT customers_shop_id_id_uniq UNIQUE (shop_id, id);
  END IF;
END
$$;

CREATE TABLE payment_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL,
  booking_id    UUID NOT NULL,
  booking_type  TEXT NOT NULL CHECK (booking_type IN ('RATE_LOCK')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ NULL,
  CONSTRAINT payment_sessions_shop_customer_fkey
    FOREIGN KEY (shop_id, customer_id)
    REFERENCES customers(shop_id, id)
    ON DELETE CASCADE,
  CONSTRAINT payment_sessions_expires_after_created_chk
    CHECK (expires_at > created_at)
);

-- Lookup index: typical access pattern is by primary key on the consume path;
-- this secondary index supports admin/diagnostic queries by booking.
CREATE INDEX idx_payment_sessions_booking
  ON payment_sessions (shop_id, booking_type, booking_id);

-- Cleanup index: sweep expired-and-unconsumed rows by background job.
CREATE INDEX idx_payment_sessions_cleanup
  ON payment_sessions (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_payment_sessions_tenant_isolation ON payment_sessions;
CREATE POLICY rls_payment_sessions_tenant_isolation ON payment_sessions
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

REVOKE ALL ON payment_sessions FROM app_user;
GRANT SELECT, INSERT, UPDATE ON payment_sessions TO app_user;

COMMIT;
