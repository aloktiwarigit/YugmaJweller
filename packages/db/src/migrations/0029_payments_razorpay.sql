-- Migration 0029: Razorpay payment columns for Story 5.7
-- Adds online-payment tracking: Razorpay order/payment IDs, webhook status,
-- and a dedup index to guarantee idempotent webhook processing.

ALTER TABLE payments
  ADD COLUMN razorpay_order_id    TEXT,
  ADD COLUMN razorpay_payment_id  TEXT,
  ADD COLUMN webhook_status       TEXT NOT NULL DEFAULT 'NA',
  ADD COLUMN webhook_received_at  TIMESTAMPTZ,
  ADD COLUMN failure_reason       TEXT;

-- Partial unique index: one confirmed payment per (shop, razorpay_payment_id).
-- WHERE clause excludes NULL so cash/manual payments don't collide.
CREATE UNIQUE INDEX idx_payments_razorpay_payment_id
  ON payments(shop_id, razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
