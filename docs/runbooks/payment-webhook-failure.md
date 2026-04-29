# Runbook: Razorpay Webhook Failure

Story 5.7 — Owner: billing team  
Last updated: 2026-04-26

---

## Overview

Razorpay sends a signed `POST /webhooks/razorpay` when a payment is captured. The handler enqueues a BullMQ job (`razorpay-webhooks`). The processor calls `confirmWebhookPayment`, which marks the payment `CONFIRMED` and writes an audit record. If this flow fails, invoices stay in `ISSUED` status with payments in `PENDING`.

---

## Symptom Checklist

| Symptom | Likely Cause |
|---------|-------------|
| Invoice stays ISSUED after customer pays | Webhook job failed 3× and was dead-lettered |
| `webhook.invalid_signature` in logs | Wrong `RAZORPAY_WEBHOOK_SECRET` or rawBody middleware misconfigured |
| `webhook.raw_body_unavailable` 500s | `rawBody: true` not passed to NestFactory, or proxy is JSON-decoding before the handler |
| Redis `SET NX` acquired but UPDATE never ran | DB connectivity issue in webhook processor |
| `PAYMENT_FAILED` audit events | Job exhausted 3 retries; see BullMQ dead-letter queue |

---

## Diagnostic Steps

### 1. Check BullMQ dead-letter queue

```bash
# Redis CLI
LRANGE bull:razorpay-webhooks:failed 0 -1
# Or via BullMQ dashboard / bull-board if installed
```

Each failed job has `attemptsMade`, `failedReason`, and the original payload including `razorpayOrderId`.

### 2. Verify signature configuration

```bash
# In the running container
echo $RAZORPAY_WEBHOOK_SECRET | wc -c   # should be non-empty
echo $PAYMENTS_ADAPTER                   # must be 'razorpay' in production
```

Test the webhook secret manually:
```bash
# Compute expected HMAC for a sample body
echo -n '{"event":"test"}' | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET"
```

### 3. Check rawBody availability

In NestJS logs at startup, confirm `rawBody: true` is logged. If not:
- Verify `main.ts` passes `{ rawBody: true }` to `NestFactory.create`
- Verify no upstream proxy (nginx, Azure Front Door) is stripping the raw body

### 4. Replay a failed webhook

If the payment was genuinely captured, manually call `confirmWebhookPayment` via a one-off script:

```typescript
// apps/api/scripts/replay-webhook.ts
import { paymentService } from '...';
await paymentService.confirmWebhookPayment(
  'pay_RAZORPAY_PAYMENT_ID',
  'order_RAZORPAY_ORDER_ID',
  '',  // shopIdHint — not used; derived from DB row
);
```

Or directly update the DB (OWNER + DBA approval required):

```sql
-- Verify the payment row exists
SELECT id, status, razorpay_order_id, shop_id
FROM payments
WHERE razorpay_order_id = 'order_xxx';

-- Mark as CONFIRMED (run inside withTenantTx or with GUC set)
SET LOCAL app.current_shop_id = '<shop_uuid>';
UPDATE payments
SET status = 'CONFIRMED',
    webhook_status = 'MANUAL_REPLAY',
    razorpay_payment_id = 'pay_xxx',
    webhook_received_at = now()
WHERE razorpay_order_id = 'order_xxx'
  AND status = 'PENDING';

INSERT INTO audit_events (shop_id, actor_user_id, action, subject_type, subject_id, metadata)
VALUES ('<shop_uuid>', '<actor_uuid>', 'PAYMENT_RECORDED', 'invoice', '<invoice_id>',
        '{"source":"manual_replay","reason":"webhook_failure"}');
```

### 5. Verify Redis idempotency key

If the job ran but the DB update failed, the Redis key may be set blocking retries:

```bash
# Check if key exists (TTL 48h)
redis-cli GET payments:webhook:pay_xxx
# If the payment is NOT confirmed in DB, delete to unblock:
redis-cli DEL payments:webhook:pay_xxx
```

---

## Escalation

| Condition | Action |
|-----------|--------|
| Payment confirmed in Razorpay but DB still PENDING | Replay webhook (step 4) |
| Signature failures after secret rotation | Re-deploy with new `RAZORPAY_WEBHOOK_SECRET` |
| Persistent DB connectivity issues | Check Azure PostgreSQL Flexible Server health |
| >5 consecutive failures | Page on-call DBA; check Redis and DB |

---

## Idempotency Guarantee

`confirmWebhookPayment` uses Redis `SET NX` (48h TTL) to deduplicate. Replaying the same `razorpayPaymentId` twice is safe — the second call is a no-op. If you delete the Redis key to replay, ensure the DB row is still `PENDING` first.

---

## Security Notes

- The `shopId` used for DB writes is derived from the `payments` row, NOT from webhook payload `notes.shopId`. Do not add any code path that trusts the payload's shopId for DML.
- All DML in `confirmWebhookPayment` runs under tenant GUC (`SET LOCAL app.current_shop_id`). RLS must stay active on the `payments` and `audit_events` tables.
- `PAYMENTS_ADAPTER=razorpay` is required in production. The API will crash on startup if this is absent, which is intentional (fail-closed guard).
