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
  createBooking: vi.fn(),
};

const mockTaSvc = {
  createBooking: vi.fn(),
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
    rows: [{ slug: 'test-shop', display_name: 'Test Shop' }],
  });
  return new CustomerController(
    mockPool as never,
    mockLoyaltySvc as never,
    mockRateLockSvc as never,
    mockTaSvc as never,
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
});
