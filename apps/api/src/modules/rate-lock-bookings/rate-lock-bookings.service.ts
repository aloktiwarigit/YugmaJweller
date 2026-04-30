import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type { PaymentsPort } from '@goldsmith/integrations-payments';
import type { PurityKey } from '@goldsmith/shared';
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

    // One active/pending lock per customer+shop (blocks duplicate PENDING_PAYMENT at app layer;
    // the DB unique index uq_rate_lock_bookings_one_active remains the definitive ACTIVE guard)
    const conflict = await this.pool.query<{ id: string }>(
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

    // Lock the current 24K rate
    const rates     = await this.pricing.getCurrentRatesForTenant(ctx);
    const locked24k = (rates as unknown as Record<string, { perGramPaise: bigint }>)['GOLD_24K'].perGramPaise;

    // Expiry duration from shop settings (default 1 day)
    const daysRow = await this.pool.query<{ rate_lock_days: number | null }>(
      `SELECT rate_lock_days FROM shop_settings WHERE shop_id = $1`,
      [ctx.shopId],
    );
    const rateLockDays = daysRow.rows[0]?.rate_lock_days ?? 1;

    // Insert booking row
    const insertRes = await this.pool.query<{ id: string; expires_at: Date }>(
      `INSERT INTO rate_lock_bookings
         (shop_id, customer_id, locked_rate_24k_paise_per_gram, expires_at, deposit_amount_paise, status)
       VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 day'), $5, 'PENDING_PAYMENT')
       RETURNING id, expires_at`,
      [ctx.shopId, dto.customerId, locked24k, rateLockDays, dto.depositAmountPaise],
    );
    const booking = insertRes.rows[0]!;

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
      await this.pool.query(
        `DELETE FROM rate_lock_bookings WHERE id = $1`,
        [booking.id],
      ).catch(() => undefined);
      throw err;
    }

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
      bookingId:                 booking.id,
      razorpayOrderId:           order.orderId,
      razorpayKeyId:             process.env['RAZORPAY_KEY_ID'] ?? '',
      expiresAt:                 booking.expires_at.toISOString(),
      lockedRate24kPaisePerGram: locked24k.toString(),
    };
  }

  // Plain superuser pool read — explicit shop_id filter provides tenant isolation.
  // Called before withTenantTx in billing.service.ts; no PoolClient available yet.
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

  // Stubs — implemented in Task 3
  async handleWebhookPayment(_bookingId: string, _razorpayPaymentId: string, _shopIdHint: string): Promise<void> {
    throw new Error('not implemented');
  }

  async confirmAndMarkUsed(_bookingId: string, _tx: PoolClient): Promise<boolean> {
    throw new Error('not implemented');
  }

  async expireStaleBookings(): Promise<number> {
    throw new Error('not implemented');
  }

  async listBookings(_opts: { customerId?: string; status?: string }): Promise<unknown[]> {
    throw new Error('not implemented');
  }

  async getBooking(_id: string): Promise<unknown> {
    throw new Error('not implemented');
  }
}
