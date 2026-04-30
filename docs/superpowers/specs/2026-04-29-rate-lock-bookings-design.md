# Rate-Lock Booking Flow — Design Spec
**Date:** 2026-04-29  
**Story:** Wave 4A — Rate-Lock Bookings (FR related to rate-lock deposit + honor)  
**Class:** A (money + Razorpay + billing integration)  
**Migration:** 0045 (pre-assigned)

---

## Decisions Locked

| # | Question | Decision |
|---|----------|----------|
| 1 | Purity scope for locked rate | Lock 24K base rate; honor by proportional scaling of all gold purities |
| 2 | Multiple active locks per customer+shop | One only — partial UNIQUE constraint on ACTIVE |
| 3 | Deposit refund on expiry/cancellation | Status-only (EXPIRED/CANCELLED); no Razorpay refund API in this story |
| 4 | Rate lock duration source | Use existing `rate_lock_days` column in `shop_settings` × 24 → hours |
| 5 | Webhook routing | Module-local endpoint on RateLockBookingsController (mirrors custom-orders pattern) |
| 6 | Billing integration pattern | `@Optional() @Inject(RateLockBookingsService)` — same as LoyaltyService/EstimateService |

---

## Data Model — Migration 0045

```sql
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
```

**`locked_rate_24k_paise_per_gram`** — IBJA 24K gold rate (paise/gram) at the moment the booking is created. Column name is intentionally explicit about which purity is stored. All other gold karat rates are derived proportionally at honor time.

**`deposit_amount_paise`** — what the customer agreed to pay at booking creation time. Set once at INSERT, never updated.

**`deposit_paid_paise`** — actual amount confirmed by Razorpay webhook. Starts at 0; set to `paymentsAdapter.fetchPayment().amountPaise` when `payment.captured` fires. Mirrors the custom-orders pattern.

**`expires_at`** — computed at insert time as `locked_at + rate_lock_days * INTERVAL '1 day'` where `rate_lock_days` comes from `shop_settings`. Default to 1 day if `rate_lock_days` is NULL.

### RLS

```sql
ALTER TABLE rate_lock_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_lock_bookings FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_rate_lock_bookings_tenant_isolation ON rate_lock_bookings
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

REVOKE ALL ON rate_lock_bookings FROM app_user;
GRANT SELECT, INSERT, UPDATE ON rate_lock_bookings TO app_user;
```

### Indexes

```sql
-- Honor lookup (the hot path — runs inside every createInvoice for a known customer)
CREATE INDEX idx_rate_lock_bookings_honor
  ON rate_lock_bookings (customer_id, shop_id, status, expires_at)
  WHERE status = 'ACTIVE';

-- Shopkeeper list view
CREATE INDEX idx_rate_lock_bookings_shop_list
  ON rate_lock_bookings (shop_id, status, created_at DESC);
```

### Uniqueness Constraint

```sql
-- One active lock per customer+shop
CREATE UNIQUE INDEX uq_rate_lock_bookings_one_active
  ON rate_lock_bookings (customer_id, shop_id)
  WHERE status = 'ACTIVE';
```

Attempting a second booking while one is ACTIVE returns 409 `rate_lock.already_active`.

---

## Module Structure

```
apps/api/src/modules/rate-lock-bookings/
  rate-lock-bookings.module.ts
  rate-lock-bookings.controller.ts
  rate-lock-bookings.service.ts
  rate-lock-bookings.service.spec.ts
```

`RateLockBookingsModule` imports: `PricingModule`, `BullMQ queue('rate-lock-expiry')`.  
`RateLockBookingsService` dependencies: `@Inject(DB_POOL)`, `@Inject(REDIS)`, `@Inject('PAYMENTS_ADAPTER') paymentsAdapter: PaymentsPort`, `PricingService`.  
`BillingModule` imports `RateLockBookingsModule` as an optional peer (same as LoyaltyModule).

---

## Service Layer

### `createBooking({ shopId, customerId, depositAmountPaise })`

1. Require authenticated tenant context.
2. Validate `depositAmountPaise > 0n`.
3. Check for existing ACTIVE booking: `SELECT id FROM rate_lock_bookings WHERE customer_id = $1 AND shop_id = $2 AND status = 'ACTIVE' AND expires_at > NOW()` → 409 if found.
4. Fetch `rates = await pricing.getCurrentRatesForTenant(ctx)` → extract `rates.GOLD_24K.perGramPaise`.
5. Fetch `rate_lock_days` from `shop_settings WHERE shop_id = $shopId`; default 1 if NULL.
6. Compute `expires_at = NOW() + rate_lock_days * INTERVAL '1 day'` (in SQL at insert time).
7. Insert row with `status = 'PENDING_PAYMENT'`.
8. Create Razorpay order:
   ```
   amount: depositAmountPaise,
   notes: { shopId, bookingId, type: 'rate_lock_deposit' }
   ```
9. Update row: `SET razorpay_order_id = $orderId`.
10. Return `{ bookingId, razorpayOrderId, razorpayKeyId, expiresAt, lockedRate24kPaisePerGram }`.

### `handleWebhookPayment(bookingId, razorpayPaymentId, shopIdHint)`

Uses manual `client.query('BEGIN/COMMIT')` (same pattern as `custom-orders.service.ts:handleRazorpayWebhook`):
1. `const payment = await this.paymentsAdapter.fetchPayment(razorpayPaymentId)` — get confirmed amount.
2. Redis NX: `SET ratelock:webhook:${razorpayPaymentId} 1 NX EX 86400` → return early if already set (idempotency).
3. Open client, SET LOCAL GUC to `shopIdHint`, BEGIN.
4. `SELECT id, status, shop_id FROM rate_lock_bookings WHERE id = $1 AND shop_id = $2 FOR UPDATE`.
5. Validate: row exists, `status = 'PENDING_PAYMENT'`.
6. `UPDATE SET status = 'ACTIVE', razorpay_payment_id = $1, deposit_paid_paise = $2`.
7. COMMIT. `auditLog(AuditAction.RATE_LOCK_ACTIVATED, { bookingId, razorpayPaymentId })`.

### Two-phase billing integration methods

Rate-lock billing integration requires two separate methods to avoid a TOCTOU problem: rate
scaling must happen BEFORE line computation (outside `withTenantTx`), but the FOR UPDATE lock
and status update must be INSIDE the invoice transaction.

**`peekActiveLock(customerId, shopId): Promise<{ lockedRate24kPaise: bigint; bookingId: string } | null>`**
- Plain `SELECT` on the platform pool (no PoolClient, no FOR UPDATE).
- `SELECT id, locked_rate_24k_paise_per_gram FROM rate_lock_bookings WHERE customer_id = $1 AND shop_id = $2 AND status = 'ACTIVE' AND expires_at > NOW() LIMIT 1`
- Called before step 4 (rate fetch) in `createInvoice`. Used only for rate scaling.
- No lock acquired here — the FOR UPDATE happens in `confirmAndMarkUsed` inside the tx.

**`confirmAndMarkUsed(bookingId, tx: PoolClient): Promise<boolean>`**
- Runs **inside** the `withTenantTx` (invoice tx), after invoice INSERT.
- `UPDATE rate_lock_bookings SET status = 'USED' WHERE id = $1 AND status = 'ACTIVE' AND expires_at > NOW()` → returns `rowCount > 0`.
- If returns `false` (lock expired in the TOCTOU window): invoice is already committed at the
  locked rate. For MVP, accept this outcome — the window is milliseconds and the customer-
  favorable pricing is acceptable. Log a warning for observability.
- Audit log `AuditAction.RATE_LOCK_USED` on success.

### `expireStaleBookings()`

BullMQ repeatable job, every 15 minutes:
```sql
UPDATE rate_lock_bookings
SET status = 'EXPIRED'
WHERE status = 'ACTIVE' AND expires_at < NOW()
```

---

## Billing Integration (`billing.service.ts`)

Constructor addition:
```typescript
@Optional() @Inject(RateLockBookingsService)
private readonly rateLockService?: RateLockBookingsService,
```

### Two-phase integration — exact insertion points

**Phase 1 — before step 4 (rate fetch):** `peekActiveLock` is a plain pool read; no tx needed.

```typescript
// After step 3b1 (customer ownership check), before step 4 (rate fetch):
const rateLockPeek = dto.customerId && this.rateLockService
  ? await this.rateLockService.peekActiveLock(dto.customerId, ctx.shopId)
  : null;

// Step 4 — unchanged:
const rates = await this.pricing.getCurrentRatesForTenant(ctx);

// Step 4b — scale rates if locked:
const effectiveRates = rateLockPeek
  ? applyRateLockScaling(rates, rateLockPeek.lockedRate24kPaise)
  : rates;
// All subsequent line computation uses effectiveRates (not rates).
```

**Phase 2 — inside `withTenantTx`, after invoice INSERT:**

```typescript
// After invoice + items INSERT (step 8), before tx commit:
if (rateLockPeek && this.rateLockService) {
  const marked = await this.rateLockService.confirmAndMarkUsed(rateLockPeek.bookingId, tx);
  if (!marked) {
    // TOCTOU: lock expired between peek and commit (millisecond window).
    // Invoice is committed at the locked rate — customer-favorable; acceptable for MVP.
    this.logger.warn({ bookingId: rateLockPeek.bookingId }, 'Rate lock expired between peek and invoice commit');
  }
}
```

### `applyRateLockScaling(rates, lockedRate24kPaise)` — pure function in rate-lock module

```typescript
const GOLD_PURITIES: PurityKey[] = ['GOLD_24K','GOLD_22K','GOLD_20K','GOLD_18K','GOLD_14K'];

function applyRateLockScaling(rates: TenantRatesResult, lockedRate24kPaise: bigint): TenantRatesResult {
  const current24k = rates.GOLD_24K.perGramPaise;
  if (current24k === 0n) return rates; // guard: should never happen; fall back to live rates
  const scaled = { ...rates };
  for (const purity of GOLD_PURITIES) {
    const current = rates[purity].perGramPaise;
    // Integer division; multiply first to preserve precision
    scaled[purity] = { ...rates[purity], perGramPaise: (current * lockedRate24kPaise) / current24k };
  }
  return scaled;
}
```

Silver purities (`SILVER_999`, `SILVER_925`) are not scaled — rate lock applies to gold only.

---

## API Endpoints

Controller: `RateLockBookingsController`, prefix `/api/v1/rate-lock/bookings`

| Method | Path | Guard | Body / Params |
|--------|------|-------|---------------|
| `POST` | `/` | `@Roles(OWNER, MANAGER)` | `{ customerId, depositAmountPaise }` |
| `GET` | `/` | Staff | Query: `customerId?`, `status?`, `page?` |
| `GET` | `/:id` | Staff | — |
| `POST` | `/webhook/razorpay` | `@SkipAuth @SkipTenant` | Raw body + `x-razorpay-signature` header |

### Webhook handler pattern (mirrors `custom-orders.controller.ts:185-238`)

1. Assert `req.rawBody` present → 500 `webhook.raw_body_unavailable`
2. Assert `signature` header present → 401 `webhook.missing_signature`
3. `paymentsAdapter.verifyWebhookSignature(rawBody, signature)` → 401 `webhook.invalid_signature` on mismatch
4. Parse JSON after verification only
5. Filter: `event !== 'payment.captured'` or `notes.type !== 'rate_lock_deposit'` → 200 no-op
6. Extract `razorpayPaymentId`, `bookingId`, `shopIdHint` from notes
7. `await this.svc.handleWebhookPayment(bookingId, razorpayPaymentId, shopIdHint)` — errors logged, not re-thrown (Razorpay expects 2xx ACK)
8. Return `{ status: 'ok' }`

---

## Mobile Screens

### `RateLockListScreen` (`apps/shopkeeper/src/features/rate-lock/RateLockListScreen.tsx`)

- Entry point: Customer Detail screen → "दर बुकिंग" tab
- Fetches `GET /rate-lock/bookings?customerId=<id>`
- Row: locked 24K rate, equivalent 22K rate (display only), expiry countdown ("3 दिन बचे" / "आज समाप्त"), status chip
- Status chips: PENDING_PAYMENT (yellow), ACTIVE (green), USED (grey), EXPIRED (red), CANCELLED (grey)
- FAB: "नई बुकिंग" → `CreateRateLockSheet`

### `RateLockDetailScreen` (`apps/shopkeeper/src/features/rate-lock/RateLockDetailScreen.tsx`)

- Shows: locked 24K rate, all karat equivalents (22K/18K/14K computed from 24K × karat/24)
- Expiry countdown (live, updates every minute)
- Status badge
- Razorpay order ID (tap to copy)
- "इनवॉइस बनाएं" button → navigates to invoice creation with customerId pre-filled

### `CreateRateLockSheet` (`apps/shopkeeper/src/features/rate-lock/CreateRateLockSheet.tsx`)

- Bottom sheet modal
- Input: deposit amount (paise, numeric keyboard)
- Shows current 24K rate (from `GET /rates/current`)
- Shows computed expiry ("आज से X दिन")
- CTA: "Razorpay से भुगतान करें" → calls `POST /rate-lock/bookings` → opens Razorpay checkout

---

## Error Handling

| Scenario | Code | HTTP |
|----------|------|------|
| Second active lock for same customer+shop | `rate_lock.already_active` | 409 |
| `depositAmountPaise <= 0` | `rate_lock.deposit_amount_required` | 400 |
| `customerId` not found in shop | `rate_lock.customer_not_found` | 404 |
| `rate_lock_days` null → default 1 | — | (handled silently) |
| Webhook for unknown bookingId | logged, 200 no-op | 200 |
| Webhook replayed (Redis NX hit) | logged, 200 no-op | 200 |
| Expired booking at honor time | `WHERE expires_at > NOW()` → returns null → live rates | — |
| Walk-in invoice (no customerId) | `peekActiveLock` skipped | — |
| `current24k === 0n` in scaling | guard: fall back to live rates | — |

---

## Test Plan

### Unit (`rate-lock-bookings.service.spec.ts`)
1. `createBooking` — happy path: inserts row with `deposit_amount_paise`, creates Razorpay order, returns bookingId
2. `createBooking` — 409 when ACTIVE lock exists for same customer+shop
3. `createBooking` — `depositAmountPaise <= 0` → 400
4. `handleWebhookPayment` — idempotent: second call with same razorpayPaymentId is a no-op (Redis NX)
5. `handleWebhookPayment` — happy path: `deposit_paid_paise` set from `paymentsAdapter.fetchPayment()`, status → ACTIVE
6. `peekActiveLock` — returns null when no ACTIVE lock exists
7. `peekActiveLock` — returns locked rate when ACTIVE lock present and not expired
8. `peekActiveLock` — returns null when lock is ACTIVE but expires_at < NOW()
9. `confirmAndMarkUsed` — returns true and sets status USED for valid ACTIVE non-expired booking
10. `confirmAndMarkUsed` — returns false (no-op) when booking already expired or USED

### Integration (`billing.service.rate-lock.spec.ts`)
1. Invoice at locked rate: `applyRateLockScaling` output used; invoice totalPaise reflects locked rate
2. Invoice after lock expiry (`peekActiveLock` returns null): live rates used; booking untouched
3. `confirmAndMarkUsed` called atomically after insert: tx rollback leaves booking ACTIVE
4. Walk-in invoice: `peekActiveLock` not called when `customerId` is null

### Webhook controller (`rate-lock-bookings.controller.spec.ts`)
1. Missing signature → 401
2. Signature mismatch → 401
3. `payment.captured` with wrong `notes.type` → 200 no-op
4. `payment.captured` happy path → 200, `handleWebhookPayment` called
5. Missing rawBody → 500

---

## Runtime Smoke Test Sequence

1. Create customer via CRM.
2. `POST /rate-lock/bookings` → get Razorpay order ID.
3. Simulate Razorpay `payment.captured` webhook (curl with correct HMAC) → booking status = `ACTIVE`.
4. `POST /invoices` for that customer → verify invoice used locked rate (compare line `ratePerGramPaise` to locked value, not live IBJA rate).
5. Check booking status = `USED`.
6. Attempt second invoice for same customer → live rates used (booking is USED now).
7. Create new booking; manually set `expires_at = NOW() - interval '1 minute'` in DB; `POST /invoices` → live rates used.

---

## Files Owned by This Story

```
packages/db/src/migrations/0045_rate_lock_bookings.sql          (new)
apps/api/src/modules/rate-lock-bookings/
  rate-lock-bookings.module.ts                                   (new)
  rate-lock-bookings.controller.ts                               (new)
  rate-lock-bookings.service.ts                                  (new)
  rate-lock-bookings.service.spec.ts                             (new)
apps/api/src/modules/billing/billing.service.ts                  (modify: add honorRateLockIfPresent call + applyRateLockScaling, mark USED in tx)
apps/shopkeeper/src/features/rate-lock/
  RateLockListScreen.tsx                                         (new)
  RateLockDetailScreen.tsx                                       (new)
  CreateRateLockSheet.tsx                                        (new)
```

**Do not touch:** TCS block, loyalty block, estimate-conversion block in `billing.service.ts`.
- Phase 1 (`peekActiveLock` + `applyRateLockScaling`) inserts after step 3b1 and wraps the `rates` variable — add `effectiveRates` and replace all downstream `rates[purity]` references with `effectiveRates[purity]`.
- Phase 2 (`confirmAndMarkUsed`) inserts inside `withTenantTx` after invoice INSERT, before tx commit — same location as loyalty `redeemPointsInTx`.
