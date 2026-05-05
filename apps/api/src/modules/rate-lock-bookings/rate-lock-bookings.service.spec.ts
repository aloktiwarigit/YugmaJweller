/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';

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
    RATE_LOCK_EXPIRY_SWEEP: 'RATE_LOCK_EXPIRY_SWEEP',
  },
}));

vi.mock('@goldsmith/db', () => ({
  withShopTx: vi.fn(async (_pool: any, _shopId: unknown, fn: (tx: unknown) => unknown) => {
    // If pool has a connect() method, use client (mirrors real withShopTx for tests that set pool.connect).
    if (typeof _pool?.connect === 'function') {
      const client = await _pool.connect();
      if (client && typeof client.query === 'function') {
        return fn(client);
      }
    }
    return fn(_pool);
  }),
  withTenantTx: vi.fn((_pool: unknown, fn: (tx: unknown) => unknown) => fn(_pool)),
}));

import { withShopTx } from '@goldsmith/db';
import { RateLockBookingsService } from './rate-lock-bookings.service';

function makePool(opts: {
  activeBooking?: boolean;
  rateLockDays?: number | null;
} = {}) {
  return {
    query: vi.fn(async (sql: string) => {
      // peekActiveLock: selects locked_rate_24k_paise_per_gram column
      if (sql.includes('locked_rate_24k_paise_per_gram') && !sql.includes('INSERT')) {
        if (opts.activeBooking) {
          return { rows: [{ id: BOOKING, locked_rate_24k_paise_per_gram: 700_000n }] };
        }
        return { rows: [] };
      }
      // conflict check: SELECT id with status IN ('ACTIVE', 'PENDING_PAYMENT')
      if (sql.includes('SELECT id') && sql.includes('status IN')) {
        if (opts.activeBooking) {
          return { rows: [{ id: BOOKING }] };
        }
        return { rows: [] };
      }
      // customer ownership check
      if (sql.includes('EXISTS') && sql.includes('customers')) {
        return { rows: [{ exists: true }] };
      }
      if (sql.includes('rate_lock_days')) {
        return { rows: [{ rate_lock_days: opts.rateLockDays ?? 3 }] };
      }
      if (sql.includes('INSERT INTO rate_lock_bookings')) {
        return { rows: [{ id: BOOKING, expires_at: new Date(Date.now() + 3 * 86400_000) }] };
      }
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
      GOLD_24K:   { perGramPaise: 700_000n, fetchedAt: new Date() },
      GOLD_22K:   { perGramPaise: 641_667n, fetchedAt: new Date() },
      GOLD_20K:   { perGramPaise: 583_333n, fetchedAt: new Date() },
      GOLD_18K:   { perGramPaise: 525_000n, fetchedAt: new Date() },
      GOLD_14K:   { perGramPaise: 408_333n, fetchedAt: new Date() },
      SILVER_999: { perGramPaise: 8_000n,   fetchedAt: new Date() },
      SILVER_925: { perGramPaise: 7_500n,   fetchedAt: new Date() },
      stale: false, source: 'ibja', overriddenPurities: [],
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

    it('deletes dangling booking row when Razorpay createOrder fails', async () => {
      const { svc, pool, payments } = makeSvc();
      payments.createOrder.mockRejectedValueOnce(new Error('razorpay timeout'));
      await expect(svc.createBooking({ customerId: CUSTOMER, depositAmountPaise: 50_000n }))
        .rejects.toThrow('razorpay timeout');
      // Verify DELETE was called with the booking id
      const deleteCalls = (pool.query as ReturnType<typeof vi.fn>).mock.calls.filter(
        (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('DELETE FROM rate_lock_bookings'),
      );
      expect(deleteCalls.length).toBe(1);
      expect(deleteCalls[0][1]).toEqual([BOOKING]);
    });
  });

  describe('peekActiveLock', () => {
    it('returns null when no ACTIVE lock exists', async () => {
      const { svc } = makeSvc({ activeBooking: false });
      expect(await svc.peekActiveLock(CUSTOMER, SHOP)).toBeNull();
    });

    it('returns locked rate + bookingId when ACTIVE lock exists', async () => {
      const { svc } = makeSvc({ activeBooking: true });
      const result = await svc.peekActiveLock(CUSTOMER, SHOP);
      expect(result).not.toBeNull();
      expect(result!.lockedRate24kPaise).toBe(700_000n);
      expect(result!.bookingId).toBe(BOOKING);
    });
  });

  describe('handleWebhookPayment', () => {
    it('happy path: fetches payment, sets status ACTIVE + deposit_paid_paise', async () => {
      const clientQuery = vi.fn(async (sql: string) => {
        if (sql.includes('SELECT id, shop_id, status')) {
          return { rows: [{ id: BOOKING, shop_id: SHOP, status: 'PENDING_PAYMENT' }] };
        }
        return { rows: [], rowCount: 0 };
      });
      const client = { query: clientQuery, release: vi.fn() };
      const pool = makePool();
      pool.connect = vi.fn(async () => client as any);

      const payments = makePayments();
      const redis = makeRedis();
      const pricing = makePricing();
      const svc = new RateLockBookingsService(pool as any, pricing as any, payments as any, redis as any);

      await svc.handleWebhookPayment(BOOKING, 'pay_001', SHOP);

      expect(payments.fetchPayment).toHaveBeenCalledWith('pay_001');
      const calls = clientQuery.mock.calls.map((c) => c[0] as string);
      expect(calls.some((s) => /status\s*=\s*'ACTIVE'/.test(s))).toBe(true);
    });

    it('idempotent: second call with same razorpayPaymentId is a no-op (Redis NX)', async () => {
      const pool = makePool();
      pool.connect = vi.fn(async () => ({ query: vi.fn(), release: vi.fn() } as any));
      const payments = makePayments();
      const redis = {
        set: vi.fn(async () => null), // NX already set — returns null
      };
      const pricing = makePricing();
      const svc = new RateLockBookingsService(pool as any, pricing as any, payments as any, redis as any);

      await svc.handleWebhookPayment(BOOKING, 'pay_already_processed', SHOP);

      expect(pool.connect).not.toHaveBeenCalled();
    });
  });

  describe('confirmAndMarkUsed', () => {
    it('returns true when booking updated (rowCount = 1)', async () => {
      const tx = { query: vi.fn(async () => ({ rowCount: 1, rows: [{ id: BOOKING }] })) } as any;
      const { svc } = makeSvc();
      expect(await svc.confirmAndMarkUsed(BOOKING, tx)).toBe(true);
    });

    it('returns false when booking expired or already USED (rowCount = 0)', async () => {
      const tx = { query: vi.fn(async () => ({ rowCount: 0, rows: [] })) } as any;
      const { svc } = makeSvc();
      expect(await svc.confirmAndMarkUsed(BOOKING, tx)).toBe(false);
    });
  });
});

describe('RateLockBookingsService.getBookingsForCustomer', () => {
  const SHOP_GBC     = '0a1b2c3d-4e5f-4000-8000-aaaaaaaaaaaa';
  const CUSTOMER_GBC = 'cccccccc-dddd-4000-8000-000000000001';

  beforeEach(() => vi.clearAllMocks());

  it('returns mapped bookings and total', async () => {
    const fakeRow = {
      id: 'rl-1', status: 'ACTIVE',
      locked_rate_24k_paise_per_gram: 700000n,
      deposit_amount_paise: 50000n,
      expires_at: new Date('2026-05-05T10:00:00.000Z'),
      locked_at:  new Date('2026-05-04T10:00:00.000Z'),
    };
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [fakeRow] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }),
    };
    vi.mocked(withShopTx).mockImplementation((_pool, _shopId, fn) => fn(mockTx as never));

    const svc = new RateLockBookingsService(
      makePool() as never,
      { getCurrentRatesForTenant: vi.fn().mockResolvedValue({
          GOLD_24K: { perGramPaise: 700000n, fetchedAt: new Date() },
        }) } as never,
      { createOrder: vi.fn(), verifySignature: vi.fn() } as never,
      { set: vi.fn().mockResolvedValue('OK') } as never,
    );

    const result = await svc.getBookingsForCustomer(CUSTOMER_GBC, SHOP_GBC, { limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]).toMatchObject({
      id: 'rl-1',
      status: 'ACTIVE',
      lockedRate24kPaisePerGram: '700000',
      depositAmountPaise: '50000',
      expiresAt: '2026-05-05T10:00:00.000Z',
      lockedAt:  '2026-05-04T10:00:00.000Z',
    });
  });

  it('returns empty list when customer has no bookings', async () => {
    const mockTx = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
    };
    vi.mocked(withShopTx).mockImplementation((_pool, _shopId, fn) => fn(mockTx as never));

    const svc = new RateLockBookingsService(
      makePool() as never,
      { getCurrentRatesForTenant: vi.fn() } as never,
      { createOrder: vi.fn(), verifySignature: vi.fn() } as never,
      { set: vi.fn().mockResolvedValue('OK') } as never,
    );

    const result = await svc.getBookingsForCustomer(CUSTOMER_GBC, SHOP_GBC, { limit: 20, offset: 0 });

    expect(result.bookings).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
