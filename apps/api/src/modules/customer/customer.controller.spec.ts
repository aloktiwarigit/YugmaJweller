import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPool = {
  query: vi.fn(),
};

const mockLoyaltySvc = {
  getLoyaltyState:      vi.fn(),
  getRecentTransactions: vi.fn(),
};

const mockRateLockSvc = {
  createBooking:          vi.fn(),
  getBookingsForCustomer: vi.fn(),
};

const mockTaSvc = {
  createBooking:          vi.fn(),
  getBookingsForCustomer: vi.fn(),
};

const mockHistorySvc = {
  getPurchaseHistory: vi.fn(),
};

const mockCustomOrdersSvc = {
  getOrdersForCustomer: vi.fn(),
};

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    runWith: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
  },
}));

import { tenantContext } from '@goldsmith/tenant-context';
import { CustomerController } from './customer.controller';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEV_CUSTOMER_ID = '00000000-0000-4000-8000-000000000999';
const SHOP_ID         = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function fakeReq(overrides: object = {}): Parameters<CustomerController['getLoyalty']>[0] {
  return {
    customerCtx: { customerId: DEV_CUSTOMER_ID, shopId: SHOP_ID },
    ...overrides,
  } as unknown as Parameters<CustomerController['getLoyalty']>[0];
}

function makeCtrl() {
  mockPool.query.mockResolvedValue({
    rows: [{ slug: 'test-shop', display_name: 'Test Shop', status: 'ACTIVE' }],
  });
  return new CustomerController(
    mockPool as never,
    mockLoyaltySvc as never,
    mockRateLockSvc as never,
    mockTaSvc as never,
    mockHistorySvc as never,
    mockCustomOrdersSvc as never,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CustomerController', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getLoyalty', () => {
    it('returns loyalty state and transactions for authenticated customer', async () => {
      const state = { pointsBalance: 100, lifetimePoints: 500, currentTier: 'GOLD', tierSince: null };
      const txns  = [{ id: 'tx1', pointsDelta: 50, reason: 'purchase', createdAt: new Date().toISOString() }];
      mockLoyaltySvc.getLoyaltyState.mockResolvedValue(state);
      mockLoyaltySvc.getRecentTransactions.mockResolvedValue(txns);

      const ctrl   = makeCtrl();
      const result = await ctrl.getLoyalty(fakeReq());

      expect(result.state).toEqual(state);
      expect(result.transactions).toEqual(txns);
      expect(tenantContext.runWith).toHaveBeenCalledTimes(2);
    });
  });

  describe('createRateLockBooking', () => {
    it('passes customerId from auth context — not from body — to service', async () => {
      const booking = {
        bookingId: 'b1',
        razorpayOrderId: 'rzp_ord_1',
        razorpayKeyId: 'rzp_key_1',
        expiresAt: new Date().toISOString(),
        lockedRate24kPaisePerGram: '700000',
      };
      mockRateLockSvc.createBooking.mockResolvedValue(booking);

      const ctrl = makeCtrl();
      const result = await ctrl.createRateLockBooking(
        fakeReq(),
        { depositAmountPaise: '50000' },
      );

      expect(result).toEqual(booking);
      expect(mockRateLockSvc.createBooking).toHaveBeenCalledWith({
        customerId:         DEV_CUSTOMER_ID,
        depositAmountPaise: 50000n,
      });
    });

    it('rejects zero deposit amount before calling service', async () => {
      const ctrl = makeCtrl();
      await expect(
        ctrl.createRateLockBooking(fakeReq(), { depositAmountPaise: '0' }),
      ).rejects.toMatchObject({ response: { code: 'rate_lock.deposit_amount_required' } });

      expect(mockRateLockSvc.createBooking).not.toHaveBeenCalled();
    });
  });

  describe('createTryAtHomeBooking', () => {
    it('enforces piece count — calls service with correct customerId', async () => {
      const booking = {
        id: 'tah1', shopId: SHOP_ID, customerId: DEV_CUSTOMER_ID,
        productIds: ['p1', 'p2'], status: 'REQUESTED',
        requestedAt: new Date().toISOString(), dispatchAt: null, returnDueAt: null, notes: null,
      };
      mockTaSvc.createBooking.mockResolvedValue(booking);

      const ctrl = makeCtrl();
      const result = await ctrl.createTryAtHomeBooking(
        fakeReq(),
        { productIds: ['p1', 'p2'] },
      );

      expect(result).toEqual(booking);
      expect(mockTaSvc.createBooking).toHaveBeenCalledWith({
        customerId: DEV_CUSTOMER_ID,
        productIds: ['p1', 'p2'],
        notes:      undefined,
      });
    });
  });

  describe('getPurchases', () => {
    it('returns purchase history from HistoryService', async () => {
      const history = { invoices: [{ invoiceId: 'inv-1', invoiceNumber: 'INV-001',
        issuedAt: '2026-04-01T10:00:00.000Z', totalPaise: '250000', status: 'PAID' }], total: 1 };
      mockHistorySvc.getPurchaseHistory.mockResolvedValue(history);

      const ctrl   = makeCtrl();
      const result = await ctrl.getPurchases(fakeReq(), { limit: 20, offset: 0 });

      expect(result).toEqual(history);
      expect(mockHistorySvc.getPurchaseHistory).toHaveBeenCalledWith(
        expect.objectContaining({ authenticated: true }),
        DEV_CUSTOMER_ID,
        { limit: 20, offset: 0 },
      );
    });
  });

  describe('getCustomOrders', () => {
    it('returns custom orders from CustomOrdersService', async () => {
      const orders = { orders: [{ id: 'ord-1', status: 'IN_PROGRESS', description: 'Ring',
        quotedAmountPaise: '100000', depositAmountPaise: '20000',
        estimatedDeliveryDate: null, createdAt: '2026-04-01T10:00:00.000Z' }], total: 1 };
      mockCustomOrdersSvc.getOrdersForCustomer.mockResolvedValue(orders);

      const ctrl   = makeCtrl();
      const result = await ctrl.getCustomOrders(fakeReq(), { limit: 20, offset: 0 });

      expect(result).toEqual(orders);
      expect(mockCustomOrdersSvc.getOrdersForCustomer).toHaveBeenCalledWith(
        DEV_CUSTOMER_ID, SHOP_ID, { limit: 20, offset: 0 },
      );
    });
  });

  describe('getRateLockBookings', () => {
    it('returns rate lock bookings from RateLockBookingsService', async () => {
      const bookings = { bookings: [{ id: 'rl-1', status: 'ACTIVE',
        lockedRate24kPaisePerGram: '700000', depositAmountPaise: '50000',
        expiresAt: '2026-05-05T10:00:00.000Z', lockedAt: '2026-05-04T10:00:00.000Z' }], total: 1 };
      mockRateLockSvc.getBookingsForCustomer.mockResolvedValue(bookings);

      const ctrl   = makeCtrl();
      const result = await ctrl.getRateLockBookings(fakeReq(), { limit: 20, offset: 0 });

      expect(result).toEqual(bookings);
      expect(mockRateLockSvc.getBookingsForCustomer).toHaveBeenCalledWith(
        DEV_CUSTOMER_ID, SHOP_ID, { limit: 20, offset: 0 },
      );
    });
  });

  describe('getTryAtHomeBookings', () => {
    it('returns try-at-home bookings from TryAtHomeBookingsService', async () => {
      const bookings = { bookings: [{ id: 'tah-1', shopId: SHOP_ID, customerId: DEV_CUSTOMER_ID,
        productIds: ['p1'], status: 'REQUESTED', requestedAt: '2026-05-01T08:00:00.000Z',
        dispatchAt: null, returnDueAt: null, notes: null }], total: 1 };
      mockTaSvc.getBookingsForCustomer.mockResolvedValue(bookings);

      const ctrl   = makeCtrl();
      const result = await ctrl.getTryAtHomeBookings(fakeReq(), { limit: 20, offset: 0 });

      expect(result).toEqual(bookings);
      expect(mockTaSvc.getBookingsForCustomer).toHaveBeenCalledWith(
        DEV_CUSTOMER_ID, SHOP_ID, { limit: 20, offset: 0 },
      );
    });
  });

  describe('getRateLockPaymentToken', () => {
    const BOOKING_ID = 'b1111111-1111-1111-1111-111111111111';
    const JTI        = 'e1111111-1111-1111-1111-111111111111';

    it('returns a paymentUrl for a PENDING_PAYMENT booking', async () => {
      // Reset all mocks to clear any leftover Once queue from prior tests.
      vi.resetAllMocks();
      // 1) booking status check  2) payment_sessions INSERT
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ status: 'PENDING_PAYMENT' }] })
        .mockResolvedValueOnce({
          rows: [{ id: JTI, expires_at: new Date(Date.now() + 5 * 60 * 1000) }],
        });
      const ctrl   = makeCtrl();
      const result = await ctrl.getRateLockPaymentToken(fakeReq(), BOOKING_ID);
      expect(result.paymentUrl).toContain('/api/v1/pay/rate-lock?token=');
    });

    it('throws NotFoundException when booking is not found', async () => {
      vi.resetAllMocks();
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const ctrl = makeCtrl();
      await expect(ctrl.getRateLockPaymentToken(fakeReq(), BOOKING_ID))
        .rejects.toMatchObject({ response: { code: 'rate_lock.not_found' } });
    });

    it('throws BadRequestException when booking is not PENDING_PAYMENT', async () => {
      vi.resetAllMocks();
      mockPool.query.mockResolvedValueOnce({ rows: [{ status: 'PAID' }] });
      const ctrl = makeCtrl();
      await expect(ctrl.getRateLockPaymentToken(fakeReq(), BOOKING_ID))
        .rejects.toMatchObject({ response: { code: 'rate_lock.not_pending_payment' } });
    });
  });
});
