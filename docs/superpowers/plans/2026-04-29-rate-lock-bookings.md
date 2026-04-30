# Rate-Lock Booking Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the rate-lock booking flow — a customer pays a Razorpay deposit to freeze today's 24K gold rate for a future invoice, and billing automatically prices at the locked rate when the booking is active.

**Architecture:** `RateLockBookingsModule` is a self-contained NestJS module with its own PAYMENTS_ADAPTER. `BillingModule` imports it and injects `RateLockBookingsService` as `@Optional()`. Billing uses a two-phase approach: `peekActiveLock` (plain pool read before pricing) + `confirmAndMarkUsed` (FOR UPDATE inside the invoice tx). Rate scaling is a module-level pure function in `billing.service.ts`.

**Tech Stack:** NestJS, PostgreSQL RLS, BullMQ, Razorpay (via PaymentsPort adapter), TanStack Query, React Native, vitest.

---

## File Map

| File | Action |
|------|--------|
| `packages/db/src/migrations/0045_rate_lock_bookings.sql` | Create |
| `packages/audit/src/audit-actions.ts` | Modify — add 4 new RATE_LOCK_* actions |
| `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.ts` | Create |
| `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.spec.ts` | Create |
| `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.controller.ts` | Create |
| `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.module.ts` | Create |
| `apps/api/src/workers/rate-lock-expiry.processor.ts` | Create |
| `apps/api/src/modules/billing/billing.service.ts` | Modify — two-phase rate-lock honor |
| `apps/api/src/modules/billing/billing.service.rate-lock.spec.ts` | Create |
| `apps/api/src/modules/billing/billing.module.ts` | Modify — import RateLockBookingsModule |
| `apps/shopkeeper/src/features/rate-lock/RateLockListScreen.tsx` | Create |
| `apps/shopkeeper/src/features/rate-lock/RateLockDetailScreen.tsx` | Create |
| `apps/shopkeeper/src/features/rate-lock/CreateRateLockSheet.tsx` | Create |

---

## Task 1: Migration + AuditAction

**Files:**
- Create: `packages/db/src/migrations/0045_rate_lock_bookings.sql`
- Modify: `packages/audit/src/audit-actions.ts`

- [ ] **Step 1.1: Create migration 0045**

```sql
-- packages/db/src/migrations/0045_rate_lock_bookings.sql
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

-- Indexes
CREATE INDEX idx_rate_lock_bookings_honor
  ON rate_lock_bookings (customer_id, shop_id, expires_at)
  WHERE status = 'ACTIVE';

CREATE INDEX idx_rate_lock_bookings_shop_list
  ON rate_lock_bookings (shop_id, status, locked_at DESC);

-- One active lock per customer+shop
CREATE UNIQUE INDEX uq_rate_lock_bookings_one_active
  ON rate_lock_bookings (customer_id, shop_id)
  WHERE status = 'ACTIVE';

COMMIT;
```

- [ ] **Step 1.2: Add AuditAction entries**

Open `packages/audit/src/audit-actions.ts`. After the last line (`ESTIMATE_EXPIRED = 'ESTIMATE_EXPIRED',`), add:

```typescript
  RATE_LOCK_BOOKING_CREATED  = 'RATE_LOCK_BOOKING_CREATED',
  RATE_LOCK_ACTIVATED        = 'RATE_LOCK_ACTIVATED',
  RATE_LOCK_USED             = 'RATE_LOCK_USED',
  RATE_LOCK_EXPIRY_SWEEP     = 'RATE_LOCK_EXPIRY_SWEEP',
```

- [ ] **Step 1.3: Commit**

```bash
git add packages/db/src/migrations/0045_rate_lock_bookings.sql packages/audit/src/audit-actions.ts
git commit -m "feat(rate-lock): migration 0045 + AuditAction entries"
```

---

## Task 2: RateLockBookingsService — createBooking + peekActiveLock

**Files:**
- Create: `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.ts`
- Create: `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.spec.ts`

- [ ] **Step 2.1: Write failing tests for createBooking + peekActiveLock**

Create `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.spec.ts`:

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

const SHOP     = '0a1b2c3d-4e5f-4000-8000-aaaaaaaaaaaa';
const CUSTOMER = 'cccccccc-dddd-4000-8000-000000000001';
const BOOKING  = 'bbbbbbbb-1111-4000-8000-000000000001';
const USER     = '11111111-2222-4000-8000-000000000000';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
    current: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
  },
}));

vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(async () => undefined),
  AuditAction: {
    RATE_LOCK_BOOKING_CREATED: 'RATE_LOCK_BOOKING_CREATED',
    RATE_LOCK_ACTIVATED: 'RATE_LOCK_ACTIVATED',
    RATE_LOCK_USED: 'RATE_LOCK_USED',
  },
}));

import { RateLockBookingsService } from './rate-lock-bookings.service';

function makePool(opts: {
  activeBooking?: boolean;
  bookingRow?: Record<string, unknown>;
  rateLockDays?: number | null;
} = {}) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      // peekActiveLock / conflict-check: SELECT id, locked_rate...
      if (sql.includes('SELECT id') && sql.includes('status = \'ACTIVE\'')) {
        if (opts.activeBooking) {
          return { rows: [{ id: BOOKING, locked_rate_24k_paise_per_gram: 700_000n }] };
        }
        return { rows: [] };
      }
      // rate_lock_days fetch
      if (sql.includes('rate_lock_days')) {
        return { rows: [{ rate_lock_days: opts.rateLockDays ?? 3 }] };
      }
      // INSERT
      if (sql.includes('INSERT INTO rate_lock_bookings')) {
        return { rows: [{ id: BOOKING, expires_at: new Date(Date.now() + 3 * 86400_000) }] };
      }
      // UPDATE razorpay_order_id
      if (sql.includes('UPDATE rate_lock_bookings SET razorpay_order_id')) {
        return { rows: [] };
      }
      return { rows: [] };
    }),
    connect: vi.fn(),
  };
}

function makePricing() {
  return {
    getCurrentRatesForTenant: vi.fn(async () => ({
      GOLD_24K: { perGramPaise: 700_000n, fetchedAt: new Date() },
      GOLD_22K: { perGramPaise: 641_667n, fetchedAt: new Date() },
    })),
  };
}

function makePayments() {
  return {
    createOrder: vi.fn(async () => ({ orderId: 'rp_order_001', amountPaise: 50_000n })),
    fetchPayment: vi.fn(async () => ({ id: 'pay_001', status: 'captured', amountPaise: 50_000n })),
    verifyWebhookSignature: vi.fn(() => true),
  };
}

function makeRedis() {
  const store = new Map<string, string>();
  return {
    set: vi.fn(async (k: string, _v: string, ..._args: unknown[]) => {
      if (!store.has(k)) { store.set(k, '1'); return 'OK'; }
      return null;
    }),
  };
}

function makeSvc(opts: Parameters<typeof makePool>[0] = {}) {
  const pool     = makePool(opts);
  const pricing  = makePricing();
  const payments = makePayments();
  const redis    = makeRedis();
  const svc = new RateLockBookingsService(pool as any, pricing as any, payments as any, redis as any);
  return { svc, pool, pricing, payments, redis };
}

describe('RateLockBookingsService', () => {
  describe('createBooking', () => {
    it('happy path: inserts booking, creates Razorpay order, returns bookingId', async () => {
      const { svc, payments } = makeSvc();
      const result = await svc.createBooking({ customerId: CUSTOMER, depositAmountPaise: 50_000n });
      expect(result.bookingId).toBe(BOOKING);
      expect(result.razorpayOrderId).toBe('rp_order_001');
      expect(payments.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amountPaise: 50_000n,
          notes: expect.objectContaining({ customerId: CUSTOMER, type: 'rate_lock_deposit' }),
        }),
      );
    });

    it('409 when ACTIVE lock already exists for customer+shop', async () => {
      const { svc } = makeSvc({ activeBooking: true });
      await expect(svc.createBooking({ customerId: CUSTOMER, depositAmountPaise: 50_000n }))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('400 when depositAmountPaise <= 0', async () => {
      const { svc } = makeSvc();
      await expect(svc.createBooking({ customerId: CUSTOMER, depositAmountPaise: 0n }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('peekActiveLock', () => {
    it('returns null when no ACTIVE lock exists', async () => {
      const { svc } = makeSvc({ activeBooking: false });
      const result = await svc.peekActiveLock(CUSTOMER, SHOP);
      expect(result).toBeNull();
    });

    it('returns locked rate + bookingId when ACTIVE lock exists', async () => {
      const { svc } = makeSvc({ activeBooking: true });
      const result = await svc.peekActiveLock(CUSTOMER, SHOP);
      expect(result).not.toBeNull();
      expect(result!.lockedRate24kPaise).toBe(700_000n);
      expect(result!.bookingId).toBe(BOOKING);
    });
  });
});
```

- [ ] **Step 2.2: Run tests — verify they fail**

```bash
cd "C:/Alok/Business Projects/Goldsmith/apps/api"
pnpm run test -- rate-lock-bookings.service.spec.ts
```
Expected: FAIL — `Cannot find module './rate-lock-bookings.service'`

- [ ] **Step 2.3: Implement createBooking + peekActiveLock**

Create `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.ts`:

```typescript
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type { Redis } from '@goldsmith/cache';
import type { PaymentsPort } from '@goldsmith/integrations-payments';
import type { PurityKey } from '@goldsmith/shared';
import { PricingService, type TenantRatesResult } from '../pricing/pricing.service';

export interface RateLockBookingResult {
  bookingId:                    string;
  razorpayOrderId:              string;
  razorpayKeyId:                string;
  expiresAt:                    string;
  lockedRate24kPaisePerGram:    string;
}

export interface ActiveLockPeek {
  bookingId:          string;
  lockedRate24kPaise: bigint;
}

// Exported pure function — used by billing.service.ts to scale gold purity rates
// when a rate-lock booking is active for the invoiced customer.
const GOLD_PURITIES: PurityKey[] = ['GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K'];

export function applyRateLockScaling(
  rates: TenantRatesResult,
  lockedRate24kPaise: bigint,
): TenantRatesResult {
  const current24k = (rates as unknown as Record<string, { perGramPaise: bigint }>)['GOLD_24K'].perGramPaise;
  if (current24k === 0n) return rates; // guard: fall back to live rates
  const scaled = { ...rates } as TenantRatesResult;
  for (const purity of GOLD_PURITIES) {
    const entry = (rates as unknown as Record<string, { perGramPaise: bigint; fetchedAt: Date }>)[purity];
    (scaled as unknown as Record<string, { perGramPaise: bigint; fetchedAt: Date }>)[purity] = {
      ...entry,
      perGramPaise: (entry.perGramPaise * lockedRate24kPaise) / current24k,
    };
  }
  return scaled;
}

@Injectable()
export class RateLockBookingsService {
  private readonly logger = new Logger(RateLockBookingsService.name);

  constructor(
    @Inject('PG_POOL')                    private readonly pool: Pool,
    @Inject(PricingService)               private readonly pricing: PricingService,
    @Inject('RATE_LOCK_PAYMENTS_ADAPTER') private readonly paymentsAdapter: PaymentsPort,
    @Inject('RATE_LOCK_REDIS')            private readonly redis: Redis,
  ) {}

  async createBooking(dto: {
    customerId:         string;
    depositAmountPaise: bigint;
  }): Promise<RateLockBookingResult> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    if (dto.depositAmountPaise <= 0n) {
      throw new BadRequestException({ code: 'rate_lock.deposit_amount_required' });
    }

    // Conflict check — one ACTIVE lock per customer+shop
    const conflict = await this.pool.query<{ id: string }>(
      `SELECT id FROM rate_lock_bookings
       WHERE customer_id = $1 AND shop_id = $2 AND status = 'ACTIVE' AND expires_at > NOW()
       LIMIT 1`,
      [dto.customerId, ctx.shopId],
    );
    if (conflict.rows.length > 0) {
      throw new ConflictException({ code: 'rate_lock.already_active' });
    }

    // Fetch current 24K rate
    const rates = await this.pricing.getCurrentRatesForTenant(ctx);
    const locked24k = (rates as unknown as Record<string, { perGramPaise: bigint }>)['GOLD_24K'].perGramPaise;

    // Fetch rate_lock_days from shop_settings; default 1 if NULL
    const daysRow = await this.pool.query<{ rate_lock_days: number | null }>(
      `SELECT rate_lock_days FROM shop_settings WHERE shop_id = $1`,
      [ctx.shopId],
    );
    const rateLockDays = daysRow.rows[0]?.rate_lock_days ?? 1;

    // Insert booking
    const insertRes = await this.pool.query<{ id: string; expires_at: Date }>(
      `INSERT INTO rate_lock_bookings
         (shop_id, customer_id, locked_rate_24k_paise_per_gram, expires_at, deposit_amount_paise, status)
       VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 day'), $5, 'PENDING_PAYMENT')
       RETURNING id, expires_at`,
      [ctx.shopId, dto.customerId, locked24k, rateLockDays, dto.depositAmountPaise],
    );
    const booking = insertRes.rows[0]!;

    // Create Razorpay order
    const receiptId = `rl-${booking.id.slice(0, 8)}`;
    const order = await this.paymentsAdapter.createOrder({
      amountPaise: dto.depositAmountPaise,
      currency: 'INR',
      receiptId,
      notes: {
        shopId:     ctx.shopId,
        bookingId:  booking.id,
        customerId: dto.customerId,
        type:       'rate_lock_deposit',
      },
    });

    // Store order ID on booking
    await this.pool.query(
      `UPDATE rate_lock_bookings SET razorpay_order_id = $1 WHERE id = $2`,
      [order.orderId, booking.id],
    );

    void auditLog(this.pool, {
      action:      AuditAction.RATE_LOCK_BOOKING_CREATED,
      subjectType: 'rate_lock_booking',
      subjectId:   booking.id,
      actorUserId: ctx.userId,
      after: {
        customerId:         dto.customerId,
        depositAmountPaise: dto.depositAmountPaise.toString(),
        locked24kPaise:     locked24k.toString(),
        expiresAt:          booking.expires_at.toISOString(),
      },
    }).catch(() => undefined);

    return {
      bookingId:                  booking.id,
      razorpayOrderId:            order.orderId,
      razorpayKeyId:              process.env['RAZORPAY_KEY_ID'] ?? '',
      expiresAt:                  booking.expires_at.toISOString(),
      lockedRate24kPaisePerGram:  locked24k.toString(),
    };
  }

  // Plain pool read (superuser bypasses RLS; explicit shop_id = $2 provides tenant isolation).
  // Called before withTenantTx in billing.service.ts — no PoolClient available yet.
  async peekActiveLock(customerId: string, shopId: string): Promise<ActiveLockPeek | null> {
    const res = await this.pool.query<{ id: string; locked_rate_24k_paise_per_gram: bigint }>(
      `SELECT id, locked_rate_24k_paise_per_gram
       FROM rate_lock_bookings
       WHERE customer_id = $1
         AND shop_id = $2
         AND status = 'ACTIVE'
         AND expires_at > NOW()
       LIMIT 1`,
      [customerId, shopId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return { bookingId: row.id, lockedRate24kPaise: row.locked_rate_24k_paise_per_gram };
  }

  // Placeholder implementations — filled in Task 3
  async handleWebhookPayment(_bookingId: string, _razorpayPaymentId: string, _shopIdHint: string): Promise<void> {
    throw new Error('not implemented');
  }

  async confirmAndMarkUsed(_bookingId: string, _tx: PoolClient): Promise<boolean> {
    throw new Error('not implemented');
  }

  async expireStaleBookings(): Promise<number> {
    throw new Error('not implemented');
  }
}
```

- [ ] **Step 2.4: Run tests — verify they pass**

```bash
cd "C:/Alok/Business Projects/Goldsmith/apps/api"
pnpm run test -- rate-lock-bookings.service.spec.ts
```
Expected: all 5 tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add apps/api/src/modules/rate-lock-bookings/
git commit -m "feat(rate-lock): RateLockBookingsService — createBooking + peekActiveLock"
```

---

## Task 3: RateLockBookingsService — handleWebhookPayment + confirmAndMarkUsed + expireStaleBookings

**Files:**
- Modify: `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.ts`
- Modify: `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.spec.ts`

- [ ] **Step 3.1: Add failing tests for handleWebhookPayment + confirmAndMarkUsed**

Append to the `describe('RateLockBookingsService', ...)` block in `rate-lock-bookings.service.spec.ts`:

```typescript
  describe('handleWebhookPayment', () => {
    it('happy path: sets status ACTIVE + deposit_paid_paise from Razorpay', async () => {
      const pool = makePool();
      // Simulate client with BEGIN/SET/COMMIT
      const clientQuery = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT id, shop_id')) {
          return { rows: [{ id: BOOKING, shop_id: SHOP, status: 'PENDING_PAYMENT' }] };
        }
        return { rows: [] };
      });
      pool.connect = vi.fn(async () => ({
        query: clientQuery,
        release: vi.fn(),
      }));
      const pricing  = makePricing();
      const payments = makePayments();
      const redis    = makeRedis();
      const svc = new RateLockBookingsService(pool as any, pricing as any, payments as any, redis as any);

      await svc.handleWebhookPayment(BOOKING, 'pay_001', SHOP);

      // fetchPayment called once
      expect(payments.fetchPayment).toHaveBeenCalledWith('pay_001');
      // UPDATE to ACTIVE
      const calls = (clientQuery as ReturnType<typeof vi.fn>).mock.calls;
      const updateCall = calls.find((c) => String(c[0]).includes('status = \'ACTIVE\''));
      expect(updateCall).toBeDefined();
    });

    it('idempotent: second call with same razorpayPaymentId is a no-op (Redis NX)', async () => {
      const pool = makePool();
      pool.connect = vi.fn(async () => ({ query: vi.fn(async () => ({ rows: [] })), release: vi.fn() }));
      const pricing  = makePricing();
      const payments = makePayments();
      const redis = {
        set: vi.fn(async () => null), // NX returns null = already set
      };
      const svc = new RateLockBookingsService(pool as any, pricing as any, payments as any, redis as any);

      await svc.handleWebhookPayment(BOOKING, 'pay_001', SHOP);
      // Pool connect never reached after Redis NX returns null
      expect(pool.connect).not.toHaveBeenCalled();
    });
  });

  describe('confirmAndMarkUsed', () => {
    it('returns true and updates status when booking is ACTIVE+unexpired', async () => {
      const tx = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('UPDATE rate_lock_bookings')) {
            return { rowCount: 1, rows: [{ id: BOOKING }] };
          }
          return { rows: [] };
        }),
      } as unknown as import('pg').PoolClient;
      const { svc } = makeSvc();
      const result = await svc.confirmAndMarkUsed(BOOKING, tx);
      expect(result).toBe(true);
    });

    it('returns false when booking expired or already USED (rowCount = 0)', async () => {
      const tx = {
        query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
      } as unknown as import('pg').PoolClient;
      const { svc } = makeSvc();
      const result = await svc.confirmAndMarkUsed(BOOKING, tx);
      expect(result).toBe(false);
    });
  });
```

- [ ] **Step 3.2: Run tests — verify new ones fail**

```bash
cd "C:/Alok/Business Projects/Goldsmith/apps/api"
pnpm run test -- rate-lock-bookings.service.spec.ts
```
Expected: 5 pass, 4 FAIL (new tests).

- [ ] **Step 3.3: Implement handleWebhookPayment + confirmAndMarkUsed + expireStaleBookings**

Replace the three placeholder methods in `rate-lock-bookings.service.ts`:

```typescript
  // Signature verification is done in the controller before this method is called.
  // shopIdHint comes from Razorpay order notes set by our server at createBooking time.
  async handleWebhookPayment(
    bookingId:          string,
    razorpayPaymentId:  string,
    shopIdHint:         string,
  ): Promise<void> {
    const payment = await this.paymentsAdapter.fetchPayment(razorpayPaymentId);

    // Redis NX idempotency — one successful delivery per razorpayPaymentId
    const idemKey = `ratelock:webhook:${razorpayPaymentId}`;
    const acquired = await this.redis.set(idemKey, '1', 'EX', 86400, 'NX');
    if (acquired === null) {
      this.logger.log({ razorpayPaymentId, bookingId }, 'Rate-lock webhook idempotency hit — skipping');
      return;
    }

    const client = await this.pool.connect(); // nosemgrep: goldsmith.require-tenant-transaction
    try {
      await client.query('BEGIN');
      // nosemgrep: goldsmith.no-raw-shop-id-param
      await client.query(`SET LOCAL app.current_shop_id = '${shopIdHint}'`);

      const res = await client.query<{ id: string; shop_id: string; status: string }>(
        `SELECT id, shop_id, status
         FROM rate_lock_bookings
         WHERE id = $1 AND shop_id = $2
         FOR UPDATE`,
        [bookingId, shopIdHint],
      );
      const row = res.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        this.logger.warn({ bookingId, shopIdHint }, 'Rate-lock webhook: booking not found or shop mismatch');
        return;
      }
      if (row.status !== 'PENDING_PAYMENT') {
        await client.query('ROLLBACK');
        this.logger.warn({ bookingId, status: row.status }, 'Rate-lock webhook: unexpected status — ignoring');
        return;
      }

      await client.query(
        `UPDATE rate_lock_bookings
         SET status              = 'ACTIVE',
             razorpay_payment_id = $2,
             deposit_paid_paise  = $3
         WHERE id = $1`,
        [bookingId, razorpayPaymentId, payment.amountPaise],
      );
      await client.query('COMMIT');

      void auditLog(this.pool, {
        action:      AuditAction.RATE_LOCK_ACTIVATED,
        subjectType: 'rate_lock_booking',
        subjectId:   bookingId,
        actorUserId: 'system',
        after:       { razorpayPaymentId, depositPaidPaise: payment.amountPaise.toString() },
      }).catch(() => undefined);

      this.logger.log({ bookingId, razorpayPaymentId }, 'Rate-lock booking activated');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  // Runs INSIDE an already-open invoice tx (PoolClient). No new transaction.
  // Returns true if the booking was successfully marked USED; false if it expired
  // in the TOCTOU window between peekActiveLock and invoice INSERT.
  async confirmAndMarkUsed(bookingId: string, tx: PoolClient): Promise<boolean> {
    const res = await tx.query<{ id: string }>(
      `UPDATE rate_lock_bookings
       SET status = 'USED'
       WHERE id = $1
         AND status = 'ACTIVE'
         AND expires_at > NOW()
       RETURNING id`,
      [bookingId],
    );
    if ((res.rowCount ?? 0) > 0) {
      void auditLog(this.pool, {
        action:      AuditAction.RATE_LOCK_USED,
        subjectType: 'rate_lock_booking',
        subjectId:   bookingId,
        actorUserId: 'system',
        after:       { status: 'USED' },
      }).catch(() => undefined);
      return true;
    }
    return false;
  }

  async expireStaleBookings(): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      `WITH expired AS (
         UPDATE rate_lock_bookings
         SET status = 'EXPIRED'
         WHERE status = 'ACTIVE' AND expires_at < NOW()
         RETURNING id
       )
       SELECT COUNT(*)::text AS count FROM expired`,
    );
    const count = parseInt(res.rows[0]?.count ?? '0', 10);
    if (count > 0) {
      void auditLog(this.pool, {
        action:      AuditAction.RATE_LOCK_EXPIRY_SWEEP,
        subjectType: 'rate_lock_booking',
        subjectId:   'sweep',
        actorUserId: 'system',
        after:       { expiredCount: count },
      }).catch(() => undefined);
    }
    return count;
  }
```

- [ ] **Step 3.4: Run all tests — verify all 9 pass**

```bash
cd "C:/Alok/Business Projects/Goldsmith/apps/api"
pnpm run test -- rate-lock-bookings.service.spec.ts
```
Expected: 9 tests PASS.

- [ ] **Step 3.5: Commit**

```bash
git add apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.ts \
        apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.spec.ts
git commit -m "feat(rate-lock): handleWebhookPayment + confirmAndMarkUsed + expireStaleBookings"
```

---

## Task 4: Expiry BullMQ Processor

**Files:**
- Create: `apps/api/src/workers/rate-lock-expiry.processor.ts`

- [ ] **Step 4.1: Create expiry processor**

```typescript
// apps/api/src/workers/rate-lock-expiry.processor.ts
import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from '@goldsmith/queue';
import { RateLockBookingsService } from '../modules/rate-lock-bookings/rate-lock-bookings.service';

export const RATE_LOCK_EXPIRY_QUEUE = 'rate-lock-expiry';

@Processor(RATE_LOCK_EXPIRY_QUEUE)
export class RateLockExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(RateLockExpiryProcessor.name);

  constructor(
    @Inject(RateLockBookingsService) private readonly svc: RateLockBookingsService,
  ) {
    super();
  }

  async process(_job: Job): Promise<{ expired: number }> {
    const count = await this.svc.expireStaleBookings();
    if (count > 0) {
      this.logger.log(`rate-lock expiry sweep: expired ${count} booking(s)`);
    }
    return { expired: count };
  }
}
```

- [ ] **Step 4.2: Commit**

```bash
git add apps/api/src/workers/rate-lock-expiry.processor.ts
git commit -m "feat(rate-lock): RateLockExpiryProcessor BullMQ worker"
```

---

## Task 5: Controller + Module + BillingModule Wiring

**Files:**
- Create: `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.controller.ts`
- Create: `apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.module.ts`
- Modify: `apps/api/src/modules/billing/billing.module.ts`

- [ ] **Step 5.1: Create RateLockBookingsController**

```typescript
// apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { PaymentsPort } from '@goldsmith/integrations-payments';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { RateLockBookingsService } from './rate-lock-bookings.service';

interface CreateBookingDto {
  customerId:         string;
  depositAmountPaise: string; // bigint serialised as string
}

@Controller('/api/v1/rate-lock/bookings')
export class RateLockBookingsController {
  private readonly logger = new Logger(RateLockBookingsController.name);

  constructor(
    @Inject(RateLockBookingsService)        private readonly svc: RateLockBookingsService,
    @Inject('RATE_LOCK_PAYMENTS_ADAPTER')   private readonly paymentsAdapter: PaymentsPort,
  ) {}

  @Post()
  @Roles('shop_admin', 'shop_manager')
  async createBooking(@Body() body: CreateBookingDto) {
    return this.svc.createBooking({
      customerId:         body.customerId,
      depositAmountPaise: BigInt(body.depositAmountPaise),
    });
  }

  @Get()
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listBookings(
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    // Simple list — query pool directly; RLS arms via withTenantTx not needed for reads
    // handled by tenantContext from middleware (TenantInterceptor arms GUC per request)
    return this.svc.listBookings({ customerId, status });
  }

  @Get(':id')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getBooking(@Param('id') id: string) {
    return this.svc.getBooking(id);
  }

  @Post('webhook/razorpay')
  @SkipAuth()
  @SkipTenant()
  async handleRazorpayWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<{ status: 'ok' }> {
    if (!req.rawBody) {
      this.logger.error('rawBody unavailable — NestJS rawBody:true not configured');
      throw new InternalServerErrorException({ code: 'webhook.raw_body_unavailable' });
    }
    const rawBody = req.rawBody.toString('utf8');

    if (!signature) {
      throw new UnauthorizedException({ code: 'webhook.missing_signature' });
    }

    const valid = this.paymentsAdapter.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      this.logger.warn('Rate-lock Razorpay webhook signature mismatch');
      throw new UnauthorizedException({ code: 'webhook.invalid_signature' });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException({ code: 'webhook.invalid_json' });
    }

    const event = typeof payload['event'] === 'string' ? payload['event'] : 'unknown';
    if (event !== 'payment.captured') return { status: 'ok' };

    const paymentEntity = (payload['payload'] as Record<string, unknown> | undefined)?.['payment'] as Record<string, unknown> | undefined;
    const entity        = paymentEntity?.['entity'] as Record<string, unknown> | undefined;
    const razorpayPaymentId = typeof entity?.['id'] === 'string' ? entity['id'] : '';
    const notes         = (entity?.['notes'] as Record<string, string> | undefined) ?? {};
    const bookingId     = notes['bookingId'] ?? '';
    const shopIdHint    = notes['shopId']    ?? '';

    if (!razorpayPaymentId || !bookingId || notes['type'] !== 'rate_lock_deposit') {
      return { status: 'ok' };
    }

    try {
      await this.svc.handleWebhookPayment(bookingId, razorpayPaymentId, shopIdHint);
    } catch (err) {
      this.logger.error({ bookingId, razorpayPaymentId, err }, 'Rate-lock webhook processing failed');
    }

    return { status: 'ok' };
  }
}
```

- [ ] **Step 5.2: Add listBookings + getBooking stub methods to service**

Append to `RateLockBookingsService` class in `rate-lock-bookings.service.ts`:

```typescript
  async listBookings(opts: { customerId?: string; status?: string }): Promise<unknown[]> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    // Uses withTenantTx so RLS arms correctly for SELECT
    const { withTenantTx } = await import('@goldsmith/db');
    return withTenantTx(this.pool, async (tx) => {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;
      if (opts.customerId) { conditions.push(`customer_id = $${idx++}`); params.push(opts.customerId); }
      if (opts.status)     { conditions.push(`status = $${idx++}`);      params.push(opts.status); }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const res = await tx.query(
        `SELECT id, customer_id, locked_rate_24k_paise_per_gram, locked_at, expires_at,
                deposit_amount_paise, deposit_paid_paise, razorpay_order_id, status
         FROM rate_lock_bookings
         ${where}
         ORDER BY locked_at DESC
         LIMIT 50`,
        params,
      );
      return res.rows.map((r) => ({
        id:                           r.id,
        customerId:                   r.customer_id,
        lockedRate24kPaisePerGram:    r.locked_rate_24k_paise_per_gram.toString(),
        lockedAt:                     r.locked_at,
        expiresAt:                    r.expires_at,
        depositAmountPaise:           r.deposit_amount_paise.toString(),
        depositPaidPaise:             r.deposit_paid_paise.toString(),
        razorpayOrderId:              r.razorpay_order_id,
        status:                       r.status,
      }));
    });
  }

  async getBooking(id: string): Promise<unknown> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const { withTenantTx } = await import('@goldsmith/db');
    return withTenantTx(this.pool, async (tx) => {
      const res = await tx.query(
        `SELECT id, customer_id, locked_rate_24k_paise_per_gram, locked_at, expires_at,
                deposit_amount_paise, deposit_paid_paise, razorpay_order_id, status
         FROM rate_lock_bookings WHERE id = $1`,
        [id],
      );
      if (!res.rows[0]) throw new NotFoundException({ code: 'rate_lock.not_found' });
      const r = res.rows[0];
      return {
        id:                           r.id,
        customerId:                   r.customer_id,
        lockedRate24kPaisePerGram:    r.locked_rate_24k_paise_per_gram.toString(),
        lockedAt:                     r.locked_at,
        expiresAt:                    r.expires_at,
        depositAmountPaise:           r.deposit_amount_paise.toString(),
        depositPaidPaise:             r.deposit_paid_paise.toString(),
        razorpayOrderId:              r.razorpay_order_id,
        status:                       r.status,
      };
    });
  }
```

- [ ] **Step 5.3: Create RateLockBookingsModule**

```typescript
// apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { Redis } from '@goldsmith/cache';
import { RazorpayAdapter, StubPaymentsAdapter } from '@goldsmith/integrations-payments';
import { AuthModule }   from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { RateLockBookingsController } from './rate-lock-bookings.controller';
import { RateLockBookingsService }    from './rate-lock-bookings.service';
import { RateLockExpiryProcessor }    from '../../workers/rate-lock-expiry.processor';
import { RATE_LOCK_EXPIRY_QUEUE }     from '../../workers/rate-lock-expiry.processor';

@Module({
  imports: [
    AuthModule,    // provides + exports PG_POOL
    PricingModule, // provides + exports PricingService
    BullModule.registerQueue({
      name: RATE_LOCK_EXPIRY_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: { age: 60 * 60 * 24 },
        removeOnFail:     { age: 60 * 60 * 24 * 7 },
      },
    }),
  ],
  controllers: [RateLockBookingsController],
  providers: [
    RateLockBookingsService,
    RateLockExpiryProcessor,
    {
      provide: 'RATE_LOCK_PAYMENTS_ADAPTER',
      useFactory: () => {
        const adapter = process.env['PAYMENTS_ADAPTER'] ?? 'stub';
        if (adapter === 'razorpay') return new RazorpayAdapter();
        if (process.env['NODE_ENV'] === 'production') {
          throw new Error('PAYMENTS_ADAPTER must be set to "razorpay" in production.');
        }
        return new StubPaymentsAdapter();
      },
    },
    {
      provide: 'RATE_LOCK_REDIS',
      useFactory: () =>
        new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 3,
        }),
    },
  ],
  exports: [RateLockBookingsService],
})
export class RateLockBookingsModule {}
```

- [ ] **Step 5.4: Add repeatable expiry job registration to the module**

In `RateLockBookingsModule`, add an `OnModuleInit` to schedule the expiry job. Open `rate-lock-bookings.module.ts` and update:

```typescript
// Add to imports at top of file:
import { Module, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from '@goldsmith/queue';

// Change class declaration to:
export class RateLockBookingsModule implements OnModuleInit {
  constructor(
    @InjectQueue(RATE_LOCK_EXPIRY_QUEUE) private readonly expiryQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Schedule repeatable sweep every 15 minutes
    await this.expiryQueue.add(
      'expire-stale',
      {},
      { repeat: { every: 15 * 60 * 1000 }, jobId: 'rate-lock-expiry-sweep' },
    );
  }
}
```

- [ ] **Step 5.5: Import RateLockBookingsModule into BillingModule**

Open `apps/api/src/modules/billing/billing.module.ts`. In the `imports` array, add `RateLockBookingsModule` after `LoyaltyModule`:

```typescript
// Add import at top:
import { RateLockBookingsModule } from '../rate-lock-bookings/rate-lock-bookings.module';

// In @Module({ imports: [...] }):
LoyaltyModule,
RateLockBookingsModule,  // <-- add here
StorageModule,
```

- [ ] **Step 5.6: Run typecheck — no errors**

```bash
cd "C:/Alok/Business Projects/Goldsmith/apps/api"
pnpm run typecheck
```
Expected: no errors.

- [ ] **Step 5.7: Commit**

```bash
git add apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.controller.ts \
        apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.module.ts \
        apps/api/src/modules/rate-lock-bookings/rate-lock-bookings.service.ts \
        apps/api/src/modules/billing/billing.module.ts
git commit -m "feat(rate-lock): RateLockBookingsController + Module + BillingModule wiring"
```

---

## Task 6: billing.service.ts Two-Phase Integration (TDD)

**Files:**
- Create: `apps/api/src/modules/billing/billing.service.rate-lock.spec.ts`
- Modify: `apps/api/src/modules/billing/billing.service.ts`

- [ ] **Step 6.1: Write failing integration tests**

Create `apps/api/src/modules/billing/billing.service.rate-lock.spec.ts`:

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SHOP      = '0a1b2c3d-4e5f-4000-8000-aaaaaaaaaaaa';
const USER      = '11111111-2222-4000-8000-000000000000';
const CUSTOMER  = 'cccccccc-dddd-4000-8000-000000000001';
const BOOKING   = 'bbbbbbbb-1111-4000-8000-000000000001';

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ authenticated: true, shopId: SHOP, userId: USER }),
    current:        () => ({ authenticated: true, shopId: SHOP, userId: USER }),
  },
}));

vi.mock('@goldsmith/db', () => ({
  withTenantTx: vi.fn(async (_pool: unknown, fn: (tx: any) => Promise<unknown>) => {
    const fakeTx = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) };
    return fn(fakeTx);
  }),
}));

vi.mock('@goldsmith/audit', () => ({
  auditLog: vi.fn(async () => undefined),
  AuditAction: {
    INVOICE_CREATED: 'INVOICE_CREATED',
    INVOICE_ISSUED: 'INVOICE_ISSUED',
    RATE_LOCK_USED: 'RATE_LOCK_USED',
  },
}));

vi.mock('@goldsmith/observability', () => ({ trackEvent: vi.fn() }));

import { BillingService } from './billing.service';
import { applyRateLockScaling } from '../rate-lock-bookings/rate-lock-bookings.service';

const LIVE_RATES = {
  GOLD_24K: { perGramPaise: 700_000n, fetchedAt: new Date() },
  GOLD_22K: { perGramPaise: 641_667n, fetchedAt: new Date() },
  GOLD_20K: { perGramPaise: 583_333n, fetchedAt: new Date() },
  GOLD_18K: { perGramPaise: 525_000n, fetchedAt: new Date() },
  GOLD_14K: { perGramPaise: 408_333n, fetchedAt: new Date() },
  SILVER_999: { perGramPaise: 8_000n,  fetchedAt: new Date() },
  SILVER_925: { perGramPaise: 7_500n,  fetchedAt: new Date() },
  stale: false,
  source: 'ibja',
  overriddenPurities: [],
};

// applyRateLockScaling unit tests
describe('applyRateLockScaling', () => {
  it('scales all GOLD_* purities proportionally to locked 24K rate', () => {
    const lockedRate = 630_000n; // locked when gold was cheaper
    const scaled = applyRateLockScaling(LIVE_RATES as any, lockedRate);

    // 24K: 700_000 × 630_000 / 700_000 = 630_000
    expect((scaled as any).GOLD_24K.perGramPaise).toBe(630_000n);
    // 22K: 641_667 × 630_000 / 700_000 = 577_500 (integer division)
    expect((scaled as any).GOLD_22K.perGramPaise).toBe(577_500n);
    // Silver unchanged
    expect((scaled as any).SILVER_999.perGramPaise).toBe(8_000n);
  });

  it('returns live rates unchanged when current24k === 0n (guard)', () => {
    const zeroRates = { ...LIVE_RATES, GOLD_24K: { perGramPaise: 0n, fetchedAt: new Date() } };
    const result = applyRateLockScaling(zeroRates as any, 500_000n);
    expect((result as any).GOLD_24K.perGramPaise).toBe(0n);
    expect((result as any).GOLD_22K.perGramPaise).toBe((LIVE_RATES as any).GOLD_22K.perGramPaise);
  });
});

// billing.service.ts integration: peekActiveLock is called; rate is scaled
describe('BillingService rate-lock integration', () => {
  const INVOICE_ID = 'inv-rl-test-001';
  const fakeTxForInsert = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) };

  function makeFakeRateLockSvc(lockExists: boolean, confirmResult = true) {
    return {
      peekActiveLock: vi.fn(async () =>
        lockExists ? { bookingId: BOOKING, lockedRate24kPaise: 630_000n } : null,
      ),
      confirmAndMarkUsed: vi.fn(async () => confirmResult),
    };
  }

  function makeFakeRepo(capturedRateCallback?: (rate: bigint) => void) {
    return {
      getInvoiceByIdempotencyKey: vi.fn(async () => null),
      insertInvoice: vi.fn(async (input: any, opts?: { onAfterInsert?: any }) => {
        capturedRateCallback?.(input.items[0]?.ratePerGramPaise);
        if (opts?.onAfterInsert) await opts.onAfterInsert(fakeTxForInsert, INVOICE_ID);
        return {
          invoice: {
            id: INVOICE_ID, shop_id: SHOP, invoice_number: 'INV-001',
            invoice_type: 'B2C', buyer_gstin: null, buyer_business_name: null,
            seller_state_code: '09', gst_treatment: 'CGST_SGST',
            cgst_metal_paise: 0n, sgst_metal_paise: 0n,
            cgst_making_paise: 0n, sgst_making_paise: 0n,
            igst_metal_paise: 0n, igst_making_paise: 0n,
            customer_id: CUSTOMER, customer_name: 'Test',
            customer_phone: null, status: 'ISSUED',
            subtotal_paise: 0n, gst_metal_paise: 0n, gst_making_paise: 0n,
            total_paise: input.totalPaise,
            idempotency_key: input.idempotencyKey,
            issued_at: input.issuedAt, created_by_user_id: input.createdByUserId,
            pan_ciphertext: null, pan_key_id: null,
            form60_encrypted: null, form60_key_id: null,
            tcs_collected_paise: 0n,
            voided_at: null, voided_by_user_id: null, void_reason: null,
            created_at: new Date(), updated_at: new Date(),
          },
          items: input.items.map((it: any, i: number) => ({
            id: `item-${i}`, shop_id: SHOP, invoice_id: INVOICE_ID,
            product_id: it.productId, description: it.description, hsn_code: '7113',
            huid: it.huid, metal_type: it.metalType, purity: it.purity,
            net_weight_g: it.netWeightG, rate_per_gram_paise: it.ratePerGramPaise,
            making_charge_pct: it.makingChargePct, gold_value_paise: it.goldValuePaise,
            making_charge_paise: it.makingChargePaise, stone_charges_paise: it.stoneChargesPaise,
            hallmark_fee_paise: it.hallmarkFeePaise, gst_metal_paise: it.gstMetalPaise,
            gst_making_paise: it.gstMakingPaise, line_total_paise: it.lineTotalPaise,
            sort_order: i,
          })),
        };
      }),
    };
  }

  function makeSvc(rateLockSvc: any, repo: any) {
    const pool = {
      query: vi.fn(async () => ({ rows: [{ exists: true }] })),
      connect: vi.fn(),
    };
    const redis = {
      get: vi.fn(async () => null),
      setex: vi.fn(async () => undefined),
      del: vi.fn(async () => undefined),
    };
    const pricing = {
      getCurrentRatesForTenant: vi.fn(async () => LIVE_RATES),
    };
    const inventory = {
      getProductRowForBilling: vi.fn(async (id: string) => ({
        id, shop_id: SHOP, metal: 'GOLD', purity: 'GOLD_22K',
        net_weight_g: '10.000', huid: 'AB12CD',
        huid_exemption_category: 'none', status: 'IN_STOCK', category: 'RING',
      })),
    };
    const settingsCache = { getMakingCharges: vi.fn(async () => null), setMakingCharges: vi.fn() };
    const settingsRepo  = { getMakingCharges: vi.fn(async () => null) };
    const kms = { encrypt: vi.fn(), decrypt: vi.fn() };
    return new BillingService(
      repo as any,
      inventory as any,
      pricing as any,
      redis as any,
      pool as any,
      kms as any,
      settingsCache as any,
      settingsRepo as any,
      undefined,       // events
      undefined,       // loyaltyService
      undefined,       // estimateService
      rateLockSvc as any,
    );
  }

  const invoiceDto = {
    customerName: 'Ramesh Kumar',
    customerId: CUSTOMER,
    lines: [{
      productId: 'prod-001',
      description: '22K Gold Ring',
      huid: null,
      stoneChargesPaise: '0',
      hallmarkFeePaise: '0',
    }],
    loyaltyPointsToRedeem: 0,
  };

  it('uses locked rate when active lock exists', async () => {
    let capturedRate: bigint | undefined;
    const repo = makeFakeRepo((rate) => { capturedRate = rate; });
    const svc = makeSvc(makeFakeRateLockSvc(true), repo);

    await svc.createInvoice(invoiceDto as any, 'idem-001');

    // GOLD_22K live = 641_667, locked24k = 630_000, current24k = 700_000
    // scaled = 641_667 × 630_000 / 700_000 = 577_500
    expect(capturedRate).toBe(577_500n);
  });

  it('uses live rate when no active lock exists', async () => {
    let capturedRate: bigint | undefined;
    const repo = makeFakeRepo((rate) => { capturedRate = rate; });
    const svc = makeSvc(makeFakeRateLockSvc(false), repo);

    await svc.createInvoice(invoiceDto as any, 'idem-002');

    expect(capturedRate).toBe(641_667n); // live 22K rate
  });

  it('calls confirmAndMarkUsed inside the invoice tx when lock exists', async () => {
    const rateLockSvc = makeFakeRateLockSvc(true);
    const svc = makeSvc(rateLockSvc, makeFakeRepo());

    await svc.createInvoice(invoiceDto as any, 'idem-003');

    expect(rateLockSvc.confirmAndMarkUsed).toHaveBeenCalledWith(BOOKING, fakeTxForInsert);
  });

  it('skips peekActiveLock for walk-in invoice (no customerId)', async () => {
    const rateLockSvc = makeFakeRateLockSvc(false);
    const svc = makeSvc(rateLockSvc, makeFakeRepo());

    await svc.createInvoice({ ...invoiceDto, customerId: undefined } as any, 'idem-004');

    expect(rateLockSvc.peekActiveLock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6.2: Run tests — verify they fail**

```bash
cd "C:/Alok/Business Projects/Goldsmith/apps/api"
pnpm run test -- billing.service.rate-lock.spec.ts
```
Expected: `applyRateLockScaling` tests FAIL (not exported from rate-lock service), billing integration FAILs (BillingService constructor arity mismatch).

- [ ] **Step 6.3: Add RateLockBookingsService import + applyRateLockScaling to billing.service.ts**

Open `apps/api/src/modules/billing/billing.service.ts`.

**a) Add import** (after the EstimateService import line):
```typescript
import { RateLockBookingsService, applyRateLockScaling } from '../rate-lock-bookings/rate-lock-bookings.service';
```

**b) Add constructor parameter** (after `@Optional() @Inject(EstimateService) private readonly estimateService?: EstimateService,`):
```typescript
@Optional() @Inject(RateLockBookingsService) private readonly rateLockService?: RateLockBookingsService,
```

**c) In `createInvoice`, after the customer ownership check (step 3b1) and BEFORE the `const rates = await this.pricing.getCurrentRatesForTenant(ctx);` line**, add:

```typescript
    // Rate-lock peek — plain pool read (superuser bypasses RLS; shop_id filter = tenant isolation)
    const rateLockPeek = dto.customerId != null && this.rateLockService != null
      ? await this.rateLockService.peekActiveLock(dto.customerId, ctx.shopId)
      : null;
```

**d) After `const rates = await this.pricing.getCurrentRatesForTenant(ctx);`**, add:

```typescript
    // Scale all GOLD_* rates if customer has an active rate-lock booking
    const effectiveRates = rateLockPeek != null
      ? applyRateLockScaling(rates, rateLockPeek.lockedRate24kPaise)
      : rates;
```

**e) In the `lines.map()` call (around line 397)**, find:
```typescript
const ratePerGramPaise = (rates as unknown as Record<string, { perGramPaise: bigint }>)[purity].perGramPaise;
```
Replace `rates` with `effectiveRates`:
```typescript
const ratePerGramPaise = (effectiveRates as unknown as Record<string, { perGramPaise: bigint }>)[purity].perGramPaise;
```

**f) Replace the existing `onAfterInsert` block** (which currently only handles loyalty). Find:
```typescript
      const onAfterInsert = willRedeem
        ? async (tx: PoolClient, invoiceId: string) => {
            await this.loyaltyService!.redeemPointsInTx(tx, ctx.shopId, {
              customerId:     dto.customerId!,
              invoiceId,
              pointsToRedeem: loyaltyPointsToRedeem,
            });
          }
        : undefined;
```
Replace with:
```typescript
      const hasRateLock = rateLockPeek != null && this.rateLockService != null;
      const onAfterInsert = (willRedeem || hasRateLock)
        ? async (tx: PoolClient, invoiceId: string) => {
            if (willRedeem) {
              await this.loyaltyService!.redeemPointsInTx(tx, ctx.shopId, {
                customerId:     dto.customerId!,
                invoiceId,
                pointsToRedeem: loyaltyPointsToRedeem,
              });
            }
            if (hasRateLock) {
              const marked = await this.rateLockService!.confirmAndMarkUsed(rateLockPeek!.bookingId, tx);
              if (!marked) {
                this.logger.warn(
                  { bookingId: rateLockPeek!.bookingId },
                  'Rate lock expired between peek and invoice commit',
                );
              }
            }
          }
        : undefined;
```

- [ ] **Step 6.4: Run tests — verify they pass**

```bash
cd "C:/Alok/Business Projects/Goldsmith/apps/api"
pnpm run test -- billing.service.rate-lock.spec.ts
```
Expected: all 6 tests PASS.

- [ ] **Step 6.5: Run full test suite — no regressions**

```bash
cd "C:/Alok/Business Projects/Goldsmith/apps/api"
pnpm run test
```
Expected: all tests PASS (billing.service.ts has a new optional constructor param; existing tests pass `undefined` which is fine).

- [ ] **Step 6.6: Typecheck**

```bash
cd "C:/Alok/Business Projects/Goldsmith/apps/api"
pnpm run typecheck
```
Expected: no errors.

- [ ] **Step 6.7: Commit**

```bash
git add apps/api/src/modules/billing/billing.service.ts \
        apps/api/src/modules/billing/billing.service.rate-lock.spec.ts
git commit -m "feat(rate-lock): billing two-phase integration — peekActiveLock + applyRateLockScaling + confirmAndMarkUsed"
```

---

## Task 7: Mobile Screens

**Files:**
- Create: `apps/shopkeeper/src/features/rate-lock/RateLockListScreen.tsx`
- Create: `apps/shopkeeper/src/features/rate-lock/RateLockDetailScreen.tsx`
- Create: `apps/shopkeeper/src/features/rate-lock/CreateRateLockSheet.tsx`

- [ ] **Step 7.1: Create RateLockListScreen**

```typescript
// apps/shopkeeper/src/features/rate-lock/RateLockListScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

interface RateLockBooking {
  id: string;
  customerId: string;
  lockedRate24kPaisePerGram: string;
  lockedAt: string;
  expiresAt: string;
  depositAmountPaise: string;
  depositPaidPaise: string;
  status: 'PENDING_PAYMENT' | 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
}

const STATUS_LABELS: Record<RateLockBooking['status'], string> = {
  PENDING_PAYMENT: 'भुगतान लंबित',
  ACTIVE:          'सक्रिय',
  USED:            'उपयोग किया',
  EXPIRED:         'समाप्त',
  CANCELLED:       'रद्द',
};

const STATUS_COLORS: Record<RateLockBooking['status'], string> = {
  PENDING_PAYMENT: '#D97706',
  ACTIVE:          '#059669',
  USED:            '#6B7280',
  EXPIRED:         '#DC2626',
  CANCELLED:       '#9CA3AF',
};

function formatRate(paisePerGram: string): string {
  const rupees = Math.round(Number(paisePerGram) / 100);
  return `₹${rupees.toLocaleString('en-IN')}/g`;
}

function expiryCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'समाप्त हो गया';
  const days = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  if (days > 0) return `${days} दिन बचे`;
  return `${hours} घंटे बचे`;
}

interface Props {
  customerId: string;
  onCreateNew: () => void;
  onSelectBooking: (bookingId: string) => void;
}

export function RateLockListScreen({ customerId, onCreateNew, onSelectBooking }: Props): React.ReactElement {
  const { data: bookings = [], isLoading, isError, refetch } = useQuery<RateLockBooking[]>({
    queryKey: ['rate-lock-bookings', customerId],
    queryFn: () =>
      api.get<RateLockBooking[]>(`/api/v1/rate-lock/bookings?customerId=${customerId}`)
         .then((r) => r.data),
    enabled: !!customerId,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#B8860B" size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText} accessibilityRole="alert">
          जानकारी लोड नहीं हो सकी। पुनः प्रयास करें।
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void refetch()}>
          <Text style={styles.retryBtnText}>पुनः प्रयास करें</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>दर बुकिंग</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={onCreateNew}
          accessibilityLabel="नई दर बुकिंग बनाएं"
        >
          <Text style={styles.newBtnText}>+ नई बुकिंग</Text>
        </TouchableOpacity>
      </View>

      {bookings.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>कोई दर बुकिंग नहीं</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelectBooking(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${STATUS_LABELS[item.status]} — ${formatRate(item.lockedRate24kPaisePerGram)}`}
            >
              <View style={styles.cardTop}>
                <Text style={styles.rateText}>{formatRate(item.lockedRate24kPaisePerGram)} (24K)</Text>
                <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[item.status] }]}>
                  <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
                </View>
              </View>
              <Text style={styles.expiryText}>{expiryCountdown(item.expiresAt)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FFFBF5' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title:        { fontSize: 20, fontWeight: '700', color: '#1C1917' },
  newBtn:       { backgroundColor: '#B8860B', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44 },
  newBtnText:   { color: '#FFF', fontWeight: '600', fontSize: 15 },
  list:         { padding: 16, gap: 12 },
  card:         { backgroundColor: '#FFF', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rateText:     { fontSize: 17, fontWeight: '700', color: '#1C1917' },
  statusChip:   { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:   { color: '#FFF', fontSize: 12, fontWeight: '600' },
  expiryText:   { fontSize: 14, color: '#6B7280' },
  emptyText:    { fontSize: 16, color: '#6B7280' },
  errorText:    { fontSize: 16, color: '#DC2626', marginBottom: 12, textAlign: 'center' },
  retryBtn:     { backgroundColor: '#B8860B', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  retryBtnText: { color: '#FFF', fontWeight: '600' },
});
```

- [ ] **Step 7.2: Create RateLockDetailScreen**

```typescript
// apps/shopkeeper/src/features/rate-lock/RateLockDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Clipboard,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

interface RateLockDetail {
  id: string;
  customerId: string;
  lockedRate24kPaisePerGram: string;
  lockedAt: string;
  expiresAt: string;
  depositAmountPaise: string;
  depositPaidPaise: string;
  razorpayOrderId: string | null;
  status: string;
}

const KARAT_FRACTIONS: { label: string; fraction: number }[] = [
  { label: '24K', fraction: 1 },
  { label: '22K', fraction: 22 / 24 },
  { label: '20K', fraction: 20 / 24 },
  { label: '18K', fraction: 18 / 24 },
  { label: '14K', fraction: 14 / 24 },
];

function formatRate(paisePerGram: bigint | number): string {
  const rupees = Math.round(Number(paisePerGram) / 100);
  return `₹${rupees.toLocaleString('en-IN')}/g`;
}

function expiryCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'समाप्त हो गया';
  const days  = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  const mins  = Math.floor((diff % 3600_000) / 60_000);
  if (days > 0) return `${days} दिन ${hours} घंटे बचे`;
  return `${hours} घंटे ${mins} मिनट बचे`;
}

interface Props {
  bookingId: string;
  onCreateInvoice: (customerId: string) => void;
}

export function RateLockDetailScreen({ bookingId, onCreateInvoice }: Props): React.ReactElement {
  const [countdown, setCountdown] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: booking, isLoading, isError } = useQuery<RateLockDetail>({
    queryKey: ['rate-lock-booking', bookingId],
    queryFn:  () => api.get<RateLockDetail>(`/api/v1/rate-lock/bookings/${bookingId}`).then((r) => r.data),
  });

  useEffect(() => {
    if (!booking) return;
    setCountdown(expiryCountdown(booking.expiresAt));
    const timer = setInterval(() => setCountdown(expiryCountdown(booking.expiresAt)), 60_000);
    return () => clearInterval(timer);
  }, [booking]);

  if (isLoading) return <View style={styles.center}><ActivityIndicator color="#B8860B" size="large" /></View>;
  if (isError || !booking) return <View style={styles.center}><Text style={styles.errorText}>जानकारी लोड नहीं हो सकी।</Text></View>;

  const base24k = Number(booking.lockedRate24kPaisePerGram);

  function handleCopy(): void {
    if (booking?.razorpayOrderId) {
      Clipboard.setString(booking.razorpayOrderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>दर बुकिंग विवरण</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>बंद की गई दरें</Text>
        {KARAT_FRACTIONS.map(({ label, fraction }) => (
          <View key={label} style={styles.rateRow}>
            <Text style={styles.karatLabel}>{label}</Text>
            <Text style={styles.rateValue}>{formatRate(Math.round(base24k * fraction))}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>समाप्ति</Text>
        <Text style={styles.countdown} accessibilityRole="timer">{countdown}</Text>
        <Text style={styles.expiryDate}>
          {new Date(booking.expiresAt).toLocaleDateString('hi-IN', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>जमा राशि</Text>
        <Text style={styles.depositText}>
          ₹{Math.round(Number(booking.depositPaidPaise) / 100).toLocaleString('en-IN')} प्राप्त
        </Text>
      </View>

      {booking.razorpayOrderId && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Razorpay ऑर्डर ID</Text>
          <TouchableOpacity onPress={handleCopy} accessibilityLabel="Razorpay order ID को कॉपी करें">
            <Text style={styles.orderId}>{copied ? 'कॉपी किया गया ✓' : booking.razorpayOrderId}</Text>
          </TouchableOpacity>
        </View>
      )}

      {booking.status === 'ACTIVE' && (
        <TouchableOpacity
          style={styles.invoiceBtn}
          onPress={() => onCreateInvoice(booking.customerId)}
          accessibilityLabel="इनवॉइस बनाएं"
          accessibilityRole="button"
        >
          <Text style={styles.invoiceBtnText}>इनवॉइस बनाएं</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FFFBF5' },
  content:      { padding: 20 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading:      { fontSize: 22, fontWeight: '700', color: '#1C1917', marginBottom: 20 },
  section:      { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 13, color: '#9CA3AF', fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  rateRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  karatLabel:   { fontSize: 16, color: '#374151', fontWeight: '500' },
  rateValue:    { fontSize: 16, color: '#1C1917', fontWeight: '700' },
  countdown:    { fontSize: 20, fontWeight: '700', color: '#059669', marginBottom: 4 },
  expiryDate:   { fontSize: 14, color: '#6B7280' },
  depositText:  { fontSize: 18, fontWeight: '600', color: '#1C1917' },
  orderId:      { fontSize: 14, color: '#6366F1', fontFamily: 'monospace' },
  invoiceBtn:   { backgroundColor: '#B8860B', borderRadius: 12, padding: 16, alignItems: 'center', minHeight: 52 },
  invoiceBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  errorText:    { color: '#DC2626', fontSize: 16 },
});
```

- [ ] **Step 7.3: Create CreateRateLockSheet**

```typescript
// apps/shopkeeper/src/features/rate-lock/CreateRateLockSheet.tsx
import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';

interface RatesResponse {
  GOLD_24K: { perGramPaise: string };
}

interface CreateBookingResult {
  bookingId: string;
  razorpayOrderId: string;
  expiresAt: string;
}

interface Props {
  customerId: string;
  shopId: string;
  onSuccess: (result: CreateBookingResult) => void;
  onClose: () => void;
}

export function CreateRateLockSheet({ customerId, shopId, onSuccess, onClose }: Props): React.ReactElement {
  const [depositRupees, setDepositRupees] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: rates, isLoading: ratesLoading } = useQuery<RatesResponse>({
    queryKey: ['current-rates'],
    queryFn: () => api.get<RatesResponse>('/api/v1/rates/current').then((r) => r.data),
  });

  const { mutate: createBooking, isPending } = useMutation({
    mutationFn: (depositAmountPaise: string) =>
      api.post<CreateBookingResult>('/api/v1/rate-lock/bookings', {
        customerId,
        depositAmountPaise,
      }).then((r) => r.data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['rate-lock-bookings', customerId] });
      onSuccess(result);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (msg === 'rate_lock.already_active') {
        setError('इस ग्राहक की एक दर बुकिंग पहले से सक्रिय है।');
      } else {
        setError('बुकिंग नहीं बन सकी। पुनः प्रयास करें।');
      }
    },
  });

  const liveRate24k = rates?.GOLD_24K?.perGramPaise
    ? Math.round(Number(rates.GOLD_24K.perGramPaise) / 100)
    : null;

  function handleSubmit(): void {
    setError(null);
    const rupees = parseInt(depositRupees.trim(), 10);
    if (!depositRupees.trim() || Number.isNaN(rupees) || rupees <= 0) {
      setError('कृपया वैध जमा राशि दर्ज करें');
      return;
    }
    const depositAmountPaise = (BigInt(rupees) * 100n).toString();
    createBooking(depositAmountPaise);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>नई दर बुकिंग</Text>

          {ratesLoading ? (
            <ActivityIndicator color="#B8860B" style={styles.loader} />
          ) : liveRate24k != null ? (
            <View style={styles.rateBox}>
              <Text style={styles.rateLabel}>आज की 24K सोने की दर</Text>
              <Text style={styles.rateValue}>₹{liveRate24k.toLocaleString('en-IN')}/g</Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>जमा राशि (₹)</Text>
          <TextInput
            style={styles.input}
            value={depositRupees}
            onChangeText={setDepositRupees}
            keyboardType="numeric"
            placeholder="जैसे: 500"
            accessibilityLabel="जमा राशि दर्ज करें"
            maxLength={8}
          />

          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, isPending && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isPending}
            accessibilityLabel="Razorpay से भुगतान करें"
            accessibilityRole="button"
            accessibilityState={{ disabled: isPending }}
          >
            {isPending
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={styles.submitBtnText}>Razorpay से भुगतान करें</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>रद्द करें</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:          { backgroundColor: '#FFFBF5', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  handle:         { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:          { fontSize: 20, fontWeight: '700', color: '#1C1917', marginBottom: 20 },
  rateBox:        { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 14, marginBottom: 20 },
  rateLabel:      { fontSize: 13, color: '#92400E', marginBottom: 4 },
  rateValue:      { fontSize: 24, fontWeight: '800', color: '#78350F' },
  inputLabel:     { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input:          { borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10, padding: 14, fontSize: 17, backgroundColor: '#FFF', minHeight: 52, marginBottom: 8 },
  errorText:      { color: '#DC2626', fontSize: 14, marginBottom: 12 },
  submitBtn:      { backgroundColor: '#B8860B', borderRadius: 12, padding: 16, alignItems: 'center', minHeight: 52, marginBottom: 12 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:  { color: '#FFF', fontSize: 17, fontWeight: '700' },
  cancelBtn:      { alignItems: 'center', padding: 12, minHeight: 44 },
  cancelBtnText:  { color: '#6B7280', fontSize: 16 },
  loader:         { marginBottom: 20 },
});
```

- [ ] **Step 7.4: Typecheck shopkeeper app**

```bash
cd "C:/Alok/Business Projects/Goldsmith/apps/shopkeeper"
pnpm run typecheck
```
Expected: no errors.

- [ ] **Step 7.5: Commit**

```bash
git add apps/shopkeeper/src/features/rate-lock/
git commit -m "feat(rate-lock): mobile screens — RateLockListScreen, RateLockDetailScreen, CreateRateLockSheet"
```

---

## Task 8: Review Gate (parallel Codex + security-review)

- [ ] **Step 8.1: Run Codex review**

```bash
cd "C:/Alok/Business Projects/Goldsmith"
codex review --base main
```
Fix every P1. Fix P2s that involve money, RLS, or Razorpay.  
On clean pass, create marker:
```bash
echo "passed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .codex-review-passed
git add .codex-review-passed && git commit -m "chore: codex review passed — feat/story-rate-lock-bookings"
```

- [ ] **Step 8.2: Run security review**

Invoke `/security-review` skill in a new Claude session. Focus areas to call out:
- Razorpay webhook signature verification (done before JSON parse)
- `shopIdHint` treated as untrusted — shop ownership verified by FOR UPDATE query
- `peekActiveLock` uses explicit `shop_id = $2` for tenant isolation despite superuser pool
- `confirmAndMarkUsed` re-validates `status = 'ACTIVE' AND expires_at > NOW()` inside tx
- No FLOAT for `locked_rate_24k_paise_per_gram`

On clean pass:
```bash
echo "passed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .security-review-passed
git add .security-review-passed && git commit -m "chore: security review passed — feat/story-rate-lock-bookings"
```

---

## Task 9: Runtime Smoke Test

- [ ] **Step 9.1: Start local services**

```bash
cd "C:/Alok/Business Projects/Goldsmith"
docker-compose up -d postgres redis
pnpm run migrate   # applies migration 0045
cd apps/api && pnpm run start:dev
```

- [ ] **Step 9.2: Create a customer via CRM**

```bash
TOKEN="<firebase_id_token>"
SHOP_ID="<shop_uuid>"

curl -s -X POST http://localhost:3000/api/v1/crm/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Shop-Id: $SHOP_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Customer","phone":"9999999999"}' | jq .id
# Save as CUSTOMER_ID
```

- [ ] **Step 9.3: Create rate-lock booking**

```bash
curl -s -X POST http://localhost:3000/api/v1/rate-lock/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Shop-Id: $SHOP_ID" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":\"$CUSTOMER_ID\",\"depositAmountPaise\":\"50000\"}" | jq .
# Save bookingId, razorpayOrderId
```
Expected: `status: PENDING_PAYMENT`, `lockedRate24kPaisePerGram` is set.

- [ ] **Step 9.4: Simulate Razorpay webhook (payment.captured)**

Replace `WEBHOOK_SECRET` with `RAZORPAY_WEBHOOK_SECRET` env value. With StubPaymentsAdapter, signature verification is bypassed in non-production:

```bash
BOOKING_ID="<booking_uuid>"
PAYLOAD="{\"event\":\"payment.captured\",\"payload\":{\"payment\":{\"entity\":{\"id\":\"pay_test_001\",\"order_id\":\"rp_order_001\",\"notes\":{\"shopId\":\"$SHOP_ID\",\"bookingId\":\"$BOOKING_ID\",\"customerId\":\"$CUSTOMER_ID\",\"type\":\"rate_lock_deposit\"}}}}}"
curl -s -X POST http://localhost:3000/api/v1/rate-lock/bookings/webhook/razorpay \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: stub" \
  -d "$PAYLOAD"
# Expected: {"status":"ok"}
```

- [ ] **Step 9.5: Verify booking is ACTIVE**

```bash
curl -s http://localhost:3000/api/v1/rate-lock/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $TOKEN" -H "X-Shop-Id: $SHOP_ID" | jq .status
# Expected: "ACTIVE"
```

- [ ] **Step 9.6: Create invoice for that customer and verify locked rate is used**

```bash
LOCKED_RATE=$(curl -s http://localhost:3000/api/v1/rate-lock/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $TOKEN" -H "X-Shop-Id: $SHOP_ID" | jq -r .lockedRate24kPaisePerGram)

curl -s -X POST http://localhost:3000/api/v1/billing/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Shop-Id: $SHOP_ID" \
  -H "Content-Type: application/json" \
  -d "{\"customerName\":\"Test Customer\",\"customerId\":\"$CUSTOMER_ID\",\"lines\":[{\"description\":\"22K Ring\",\"purity\":\"GOLD_22K\",\"netWeightG\":\"5.000\",\"stoneChargesPaise\":\"0\",\"hallmarkFeePaise\":\"0\"}]}" \
  -H "Idempotency-Key: smoke-$(date +%s)" | jq '.items[0].ratePerGramPaise'
# Expected: scaled rate (= LIVE_22K × LOCKED_24K / LIVE_24K), NOT the current live 22K rate
```

- [ ] **Step 9.7: Verify booking is now USED**

```bash
curl -s http://localhost:3000/api/v1/rate-lock/bookings/$BOOKING_ID \
  -H "Authorization: Bearer $TOKEN" -H "X-Shop-Id: $SHOP_ID" | jq .status
# Expected: "USED"
```

- [ ] **Step 9.8: Verify expired booking is NOT honored**

```bash
# Manually expire the lock in DB:
psql "$DATABASE_URL" -c "UPDATE rate_lock_bookings SET expires_at = NOW() - interval '1 minute' WHERE id = '$BOOKING_ID2';"
# (create a second booking and expire it, or test with a new booking)
# Then create invoice — verify ratePerGramPaise equals the live rate, not a locked rate
```

- [ ] **Step 9.9: Push branch**

```bash
git push -u origin feat/story-rate-lock-bookings
```

---

## Self-Review Checklist

- [x] Migration 0045 with `deposit_amount_paise` + `deposit_paid_paise` columns, UNIQUE partial index for ACTIVE lock
- [x] `createBooking` — conflict check, rate fetch, Razorpay order, audit log
- [x] `peekActiveLock` — superuser pool, explicit shop_id filter, no FOR UPDATE
- [x] `handleWebhookPayment` — Redis NX idempotency, manual client pattern (nosemgrep), `paymentsAdapter.fetchPayment` for amount, FOR UPDATE shop ownership check
- [x] `confirmAndMarkUsed` — UPDATE WHERE status='ACTIVE' AND expires_at > NOW(), returns boolean
- [x] `applyRateLockScaling` — exported pure function, GOLD_* only, integer arithmetic, 0n guard
- [x] `billing.service.ts` — `peekActiveLock` before rate fetch, `effectiveRates` replaces `rates` in lines.map, `confirmAndMarkUsed` in `onAfterInsert` alongside loyalty
- [x] Webhook controller — verify signature BEFORE JSON parse, filter by `notes.type = 'rate_lock_deposit'`
- [x] Module — own `RATE_LOCK_PAYMENTS_ADAPTER` token (no circular dep with BillingModule)
- [x] BullMQ expiry processor + repeatable job every 15 minutes
- [x] Mobile screens — Hindi text, ≥44pt touch targets, WCAG AA colors, no platform brand leakage
- [x] Review gate — Codex + security-review markers required before push
