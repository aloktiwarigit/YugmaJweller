import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { withShopTx, withTenantTx } from '@goldsmith/db';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type { PaymentsPort } from '@goldsmith/integrations-payments';
import type { PurityKey } from '@goldsmith/shared';
import { platformGlobalExecute } from '../../platform-global-execute';
import { PricingService } from '../pricing/pricing.service';
import type { TenantRatesResult } from '../pricing/pricing.service';

export interface RateLockBookingResult {
  bookingId:                 string;
  razorpayOrderId:           string;
  razorpayKeyId:             string;
  expiresAt:                 string;
  lockedRate24kPaisePerGram: string;
}

export interface ActiveLockPeek {
  bookingId:          string;
  lockedRate24kPaise: bigint;
}

export interface CustomerRateLockItem {
  id:                        string;
  status:                    string;
  lockedRate24kPaisePerGram: string;
  depositAmountPaise:        string;
  expiresAt:                 string;
  lockedAt:                  string;
}

// Pure function exported for billing.service.ts — scales all GOLD_* purity rates
// proportionally when a customer has an active rate-lock booking.
const GOLD_PURITIES: PurityKey[] = ['GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K'];

export function applyRateLockScaling(
  rates: TenantRatesResult,
  lockedRate24kPaise: bigint,
): TenantRatesResult {
  const current24k = (rates as unknown as Record<string, { perGramPaise: bigint }>)['GOLD_24K'].perGramPaise;
  if (current24k === 0n) return rates;
  const scaled = { ...rates } as TenantRatesResult;
  for (const purity of GOLD_PURITIES) {
    const entry = (rates as unknown as Record<string, { perGramPaise: bigint; fetchedAt: Date }>)[purity];
    (scaled as unknown as Record<string, { perGramPaise: bigint; fetchedAt: Date }>)[purity] = {
      ...entry,
      perGramPaise: (entry.perGramPaise * lockedRate24kPaise + current24k / 2n) / current24k,
    };
  }
  return scaled;
}

type RedisLike = { set(key: string, value: string, ...args: unknown[]): Promise<string | null> };

@Injectable()
export class RateLockBookingsService {
  private readonly logger = new Logger(RateLockBookingsService.name);

  constructor(
    @Inject('PG_POOL')                    private readonly pool: Pool,
    @Inject(PricingService)               private readonly pricing: PricingService,
    @Inject('RATE_LOCK_PAYMENTS_ADAPTER') private readonly paymentsAdapter: PaymentsPort,
    @Inject('RATE_LOCK_REDIS')            private readonly redis: RedisLike,
  ) {}

  async createBooking(dto: {
    customerId:         string;
    depositAmountPaise: bigint;
  }): Promise<RateLockBookingResult> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;

    if (dto.depositAmountPaise <= 0n) {
      throw new BadRequestException({ code: 'rate_lock.deposit_amount_required' });
    }

    // Lock the current 24K rate
    const rates     = await this.pricing.getCurrentRatesForTenant(ctx);
    const locked24k = (rates as unknown as Record<string, { perGramPaise: bigint }>)['GOLD_24K'].perGramPaise;

    const booking = await withShopTx(this.pool, ctx.shopId, async (tx) => {
      // One active/pending lock per customer+shop (blocks duplicate PENDING_PAYMENT at app layer;
      // the DB unique index uq_rate_lock_bookings_one_active remains the definitive ACTIVE guard)
      const conflict = await tx.query<{ id: string }>(
        `SELECT id FROM rate_lock_bookings
         WHERE customer_id = $1 AND shop_id = $2
           AND status IN ('ACTIVE', 'PENDING_PAYMENT')
           AND expires_at > NOW()
         LIMIT 1`,
        [dto.customerId, ctx.shopId],
      );
      if (conflict.rows.length > 0) {
        throw new ConflictException({ code: 'rate_lock.already_active' });
      }

      // Expiry duration from shop settings (default 1 day)
      const daysRow = await tx.query<{ rate_lock_days: number | null }>(
        `SELECT rate_lock_days FROM shop_settings WHERE shop_id = $1`,
        [ctx.shopId],
      );
      const rateLockDays = daysRow.rows[0]?.rate_lock_days ?? 1;

      // Validate the customer belongs to this tenant before creating the booking.
      // The FK on customer_id only proves the customer exists, not that it belongs to ctx.shopId.
      const ownerCheck = await tx.query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM customers WHERE id = $1 AND shop_id = $2) AS exists`,
        [dto.customerId, ctx.shopId],
      );
      if (!ownerCheck.rows[0]?.exists) {
        throw new BadRequestException({ code: 'customer.not_found_in_shop' });
      }

      // Insert booking row
      const insertRes = await tx.query<{ id: string; expires_at: Date }>(
        `INSERT INTO rate_lock_bookings
           (shop_id, customer_id, locked_rate_24k_paise_per_gram, expires_at, deposit_amount_paise, status)
         VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 day'), $5, 'PENDING_PAYMENT')
         RETURNING id, expires_at`,
        [ctx.shopId, dto.customerId, locked24k, rateLockDays, dto.depositAmountPaise],
      );
      return insertRes.rows[0]!;
    });

    // Create Razorpay order; clean up the booking row if this fails so we don't leave
    // a dangling PENDING_PAYMENT row with no order ID.
    let order: { orderId: string; amountPaise: bigint };
    try {
      order = await this.paymentsAdapter.createOrder({
        amountPaise: dto.depositAmountPaise,
        currency:    'INR',
        receiptId:   `rl-${booking.id.slice(0, 8)}`,
        notes: {
          shopId:     ctx.shopId,
          bookingId:  booking.id,
          customerId: dto.customerId,
          type:       'rate_lock_deposit',
        },
      });
    } catch (err) {
      // Best-effort cleanup — ignore secondary failure so original error propagates
      await withShopTx(this.pool, ctx.shopId, async (tx) => {
        await tx.query(
          `DELETE FROM rate_lock_bookings WHERE id = $1`,
          [booking.id],
        );
      }).catch(() => undefined);
      throw err;
    }

    await withShopTx(this.pool, ctx.shopId, async (tx) => {
      await tx.query(
        `UPDATE rate_lock_bookings SET razorpay_order_id = $1 WHERE id = $2`,
        [order.orderId, booking.id],
      );
    });

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

    void auditLog(this.pool, {
      action:      AuditAction.CUSTOMER_RATE_LOCK_CREATED,
      subjectType: 'rate_lock_booking',
      subjectId:   booking.id,
      actorUserId: dto.customerId,
      after:       { shopId: ctx.shopId, lockedRatePaise: locked24k.toString() },
    }).catch(() => undefined);

    return {
      bookingId:                 booking.id,
      razorpayOrderId:           order.orderId,
      razorpayKeyId:             process.env['RAZORPAY_KEY_ID'] ?? '',
      expiresAt:                 booking.expires_at.toISOString(),
      lockedRate24kPaisePerGram: locked24k.toString(),
    };
  }

  // Plain superuser pool read — explicit shop_id filter provides tenant isolation.
  // Called before withTenantTx in billing.service.ts; no PoolClient available yet.
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- internal; shopId from billing TenantContext caller
  async peekActiveLock(customerId: string, shopId: string): Promise<ActiveLockPeek | null> {
    const res = await withShopTx(this.pool, shopId, async (tx) =>
      tx.query<{ id: string; locked_rate_24k_paise_per_gram: bigint }>(
        `SELECT id, locked_rate_24k_paise_per_gram
         FROM rate_lock_bookings
         WHERE customer_id = $1
           AND shop_id = $2
           AND status = 'ACTIVE'
           AND expires_at > NOW()
         LIMIT 1`,
        [customerId, shopId],
      ),
    );
    const row = res.rows[0];
    if (!row) return null;
    return { bookingId: row.id, lockedRate24kPaise: row.locked_rate_24k_paise_per_gram };
  }

  async handleWebhookPayment(
    bookingId:         string,
    razorpayPaymentId: string,
    shopIdHint:        string,
  ): Promise<void> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(shopIdHint)) {
      this.logger.warn({ shopIdHint }, 'Rate-lock webhook: invalid shopIdHint format — rejecting');
      return;
    }

    const payment = await this.paymentsAdapter.fetchPayment(razorpayPaymentId);

    const idemKey = `ratelock:webhook:${razorpayPaymentId}`;
    const acquired = await this.redis.set(idemKey, '1', 'EX', 86400, 'NX');
    if (acquired === null) {
      this.logger.log({ razorpayPaymentId, bookingId }, 'Rate-lock webhook idempotency hit — skipping');
      return;
    }

    let activated = false;
    await withShopTx(this.pool, shopIdHint, async (client) => {
      const res = await client.query<{ id: string; shop_id: string; status: string }>(
        `SELECT id, shop_id, status FROM rate_lock_bookings WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
        [bookingId, shopIdHint],
      );
      const row = res.rows[0];
      if (!row) {
        this.logger.warn({ bookingId, shopIdHint }, 'Rate-lock webhook: booking not found or shop mismatch');
        return;
      }
      if (row.status !== 'PENDING_PAYMENT') {
        this.logger.warn({ bookingId, status: row.status }, 'Rate-lock webhook: unexpected status — ignoring');
        return;
      }

      await client.query(
        `UPDATE rate_lock_bookings
         SET status              = 'ACTIVE',
             razorpay_payment_id = $2,
             deposit_paid_paise  = $3
         WHERE id = $1
           AND shop_id = $4`,
        [bookingId, razorpayPaymentId, payment.amountPaise, shopIdHint],
      );
      activated = true;
    });
    if (!activated) return;

    void auditLog(this.pool, {
      action:      AuditAction.RATE_LOCK_ACTIVATED,
      subjectType: 'rate_lock_booking',
      subjectId:   bookingId,
      actorUserId: 'system',
      after:       { razorpayPaymentId, depositPaidPaise: payment.amountPaise.toString() },
    }).catch(() => undefined);

    this.logger.log({ bookingId, razorpayPaymentId }, 'Rate-lock booking activated');
  }

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
    const res = await platformGlobalExecute(
      'background rate-lock expiry sweep across tenants',
      async () => this.pool.query<{ count: string }>(
        `WITH expired AS (
           UPDATE rate_lock_bookings
           SET status = 'EXPIRED'
           WHERE status = 'ACTIVE' AND expires_at < NOW()
           RETURNING id
         )
         SELECT COUNT(*)::text AS count FROM expired`,
      ),
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

  async getBookingsForCustomer(
    customerId: string,
    // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- customer-facing endpoint; shopId from CustomerAuthGuard JWT, not TenantContext
    shopId: string,
    params: { limit: number; offset: number },
  ): Promise<{ bookings: CustomerRateLockItem[]; total: number }> {
    const [data, count] = await withShopTx(this.pool, shopId, (tx) =>
      Promise.all([
        tx.query<{
          id: string; status: string;
          locked_rate_24k_paise_per_gram: bigint;
          deposit_amount_paise: bigint;
          expires_at: Date; locked_at: Date;
        }>(
          `SELECT id, status, locked_rate_24k_paise_per_gram, deposit_amount_paise,
                  expires_at, locked_at
           FROM rate_lock_bookings
           WHERE customer_id = $1 AND shop_id = $2
           ORDER BY locked_at DESC
           LIMIT $3 OFFSET $4`,
          [customerId, shopId, params.limit, params.offset],
        ),
        tx.query<{ count: string }>(
          `SELECT COUNT(*) FROM rate_lock_bookings
           WHERE customer_id = $1 AND shop_id = $2`,
          [customerId, shopId],
        ),
      ]),
    );
    return {
      bookings: data.rows.map((r) => ({
        id:                        r.id,
        status:                    r.status,
        lockedRate24kPaisePerGram: r.locked_rate_24k_paise_per_gram.toString(),
        depositAmountPaise:        r.deposit_amount_paise.toString(),
        expiresAt:                 r.expires_at.toISOString(),
        lockedAt:                  r.locked_at.toISOString(),
      })),
      total: Number(count.rows[0]!.count),
    };
  }

  async listBookings(opts: { customerId?: string; status?: string }): Promise<unknown[]> {
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
        id:                        r.id,
        customerId:                r.customer_id,
        lockedRate24kPaisePerGram: r.locked_rate_24k_paise_per_gram.toString(),
        lockedAt:                  r.locked_at,
        expiresAt:                 r.expires_at,
        depositAmountPaise:        r.deposit_amount_paise.toString(),
        depositPaidPaise:          r.deposit_paid_paise.toString(),
        razorpayOrderId:           r.razorpay_order_id,
        status:                    r.status,
      }));
    });
  }

  async getBooking(id: string): Promise<unknown> {
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
        id:                        r.id,
        customerId:                r.customer_id,
        lockedRate24kPaisePerGram: r.locked_rate_24k_paise_per_gram.toString(),
        lockedAt:                  r.locked_at,
        expiresAt:                 r.expires_at,
        depositAmountPaise:        r.deposit_amount_paise.toString(),
        depositPaidPaise:          r.deposit_paid_paise.toString(),
        razorpayOrderId:           r.razorpay_order_id,
        status:                    r.status,
      };
    });
  }
}
