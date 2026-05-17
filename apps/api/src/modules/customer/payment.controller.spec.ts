import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentController } from './payment.controller';
import {
  signPaymentToken,
  type PaymentTokenClaims,
} from './payment-token';

const BOOKING_ID  = 'b1111111-1111-1111-1111-111111111111';
const CUSTOMER_ID = 'c1111111-1111-1111-1111-111111111111';
const SHOP_ID     = 'd1111111-1111-1111-1111-111111111111';
const JTI         = 'e1111111-1111-1111-1111-111111111111';

function makeClaims(overrides: Partial<PaymentTokenClaims> = {}): PaymentTokenClaims {
  return {
    jti:        JTI,
    bookingId:  BOOKING_ID,
    customerId: CUSTOMER_ID,
    shopId:     SHOP_ID,
    exp:        Date.now() + 5 * 60 * 1000,
    ...overrides,
  };
}

// `withShopTx` (packages/db/src/tx.ts) falls through to calling fn(pool) when
// pool.connect is not a function. So a plain `{ query }` mock is enough to
// drive the controller through the full SELECT + SELECT + consume flow.
function makeMockPool(queryQueue: Array<{ rows: unknown[]; rowCount?: number }>) {
  const query = vi.fn().mockImplementation(() => {
    const next = queryQueue.shift();
    if (!next) return Promise.resolve({ rows: [], rowCount: 0 });
    return Promise.resolve({ rowCount: next.rows.length, ...next });
  });
  return { pool: { query } as never, query };
}

interface ResStub {
  status: (code: number) => ResStub;
  send:   (html: string) => ResStub;
}
function makeRes() {
  let statusCode = 200;
  let body = '';
  const stub: ResStub = {
    status: (code: number) => { statusCode = code; return stub; },
    send:   (html: string) => { body = html; return stub; },
  };
  return { res: stub as never, getStatus: () => statusCode, getBody: () => body };
}

describe('PaymentController.rateLockPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the Razorpay checkout HTML on the happy path', async () => {
    const token = signPaymentToken(makeClaims());
    const { pool, query } = makeMockPool([
      { rows: [{ razorpay_order_id: 'rzp_ord_1', deposit_amount_paise: '50000', status: 'PENDING_PAYMENT' }] },
      { rows: [{ display_name: 'Test Jeweller', status: 'ACTIVE' }] },
      { rows: [{
        shop_id: SHOP_ID, customer_id: CUSTOMER_ID, booking_id: BOOKING_ID, booking_type: 'RATE_LOCK',
        expires_at: new Date(Date.now() + 5 * 60 * 1000), consumed_at: null,
      }] },
      { rows: [{ id: JTI }] }, // UPDATE ... RETURNING
    ]);
    const ctrl = new PaymentController(pool);
    const { res, getStatus, getBody } = makeRes();
    await ctrl.rateLockPage(token, res);
    expect(getStatus()).toBe(200);
    expect(getBody()).toContain('Razorpay');
    expect(getBody()).toContain('Test Jeweller');
    // Final query is the conditional UPDATE that consumes the session.
    const lastCall = query.mock.calls[query.mock.calls.length - 1]!;
    expect(lastCall[0]).toMatch(/UPDATE payment_sessions/);
  });

  it('returns 401 when token signature is invalid', async () => {
    const { pool } = makeMockPool([]);
    const ctrl = new PaymentController(pool);
    const { res, getStatus, getBody } = makeRes();
    await ctrl.rateLockPage('garbage', res);
    expect(getStatus()).toBe(401);
    expect(getBody()).toContain('अमान्य');
  });

  it('returns 401 when token is missing', async () => {
    const { pool } = makeMockPool([]);
    const ctrl = new PaymentController(pool);
    const { res, getStatus } = makeRes();
    await ctrl.rateLockPage(undefined, res);
    expect(getStatus()).toBe(401);
  });

  it('returns 401 when token signed with a stale exp (expired)', async () => {
    const token = signPaymentToken(makeClaims({ exp: Date.now() - 1000 }));
    const { pool } = makeMockPool([]);
    const ctrl = new PaymentController(pool);
    const { res, getStatus } = makeRes();
    await ctrl.rateLockPage(token, res);
    expect(getStatus()).toBe(401);
  });

  it('returns 401 when shopId claim is not a UUID', async () => {
    const token = signPaymentToken(makeClaims({ shopId: 'not-a-uuid' }));
    const { pool, query } = makeMockPool([]);
    const ctrl = new PaymentController(pool);
    const { res, getStatus } = makeRes();
    await ctrl.rateLockPage(token, res);
    expect(getStatus()).toBe(401);
    expect(query).not.toHaveBeenCalled(); // never reaches SET LOCAL
  });

  it('returns 409 on replay (session already consumed)', async () => {
    const token = signPaymentToken(makeClaims());
    const { pool } = makeMockPool([
      { rows: [{ razorpay_order_id: 'rzp_ord_1', deposit_amount_paise: '50000', status: 'PENDING_PAYMENT' }] },
      { rows: [{ display_name: 'Test Jeweller', status: 'ACTIVE' }] },
      { rows: [{
        shop_id: SHOP_ID, customer_id: CUSTOMER_ID, booking_id: BOOKING_ID, booking_type: 'RATE_LOCK',
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        consumed_at: new Date(), // already consumed
      }] },
    ]);
    const ctrl = new PaymentController(pool);
    const { res, getStatus, getBody } = makeRes();
    await ctrl.rateLockPage(token, res);
    expect(getStatus()).toBe(409);
    expect(getBody()).toContain('पहले ही');
  });

  it('returns 404 when booking is not found', async () => {
    const token = signPaymentToken(makeClaims());
    const { pool } = makeMockPool([{ rows: [] }]); // booking SELECT → 0 rows
    const ctrl = new PaymentController(pool);
    const { res, getStatus } = makeRes();
    await ctrl.rateLockPage(token, res);
    expect(getStatus()).toBe(404);
  });

  it('returns 404 and DOES NOT consume the session when booking is not PENDING_PAYMENT', async () => {
    const token = signPaymentToken(makeClaims());
    const { pool, query } = makeMockPool([
      { rows: [{ razorpay_order_id: 'rzp_ord_1', deposit_amount_paise: '50000', status: 'CANCELLED' }] },
    ]);
    const ctrl = new PaymentController(pool);
    const { res, getStatus } = makeRes();
    await ctrl.rateLockPage(token, res);
    expect(getStatus()).toBe(404);
    // Should only have called SELECT booking — no shop, no session, no UPDATE.
    const sqlCalls = query.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.some((s) => /UPDATE payment_sessions/.test(s))).toBe(false);
  });

  it('returns 500 and DOES NOT consume the session when razorpay_order_id is missing', async () => {
    const token = signPaymentToken(makeClaims());
    const { pool, query } = makeMockPool([
      { rows: [{ razorpay_order_id: null, deposit_amount_paise: '50000', status: 'PENDING_PAYMENT' }] },
    ]);
    const ctrl = new PaymentController(pool);
    const { res, getStatus } = makeRes();
    await ctrl.rateLockPage(token, res);
    expect(getStatus()).toBe(500);
    const sqlCalls = query.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.some((s) => /UPDATE payment_sessions/.test(s))).toBe(false);
  });

  it('returns 404 and DOES NOT consume the session when shop is not ACTIVE', async () => {
    const token = signPaymentToken(makeClaims());
    const { pool, query } = makeMockPool([
      { rows: [{ razorpay_order_id: 'rzp_ord_1', deposit_amount_paise: '50000', status: 'PENDING_PAYMENT' }] },
      { rows: [{ display_name: 'Test Jeweller', status: 'SUSPENDED' }] },
    ]);
    const ctrl = new PaymentController(pool);
    const { res, getStatus } = makeRes();
    await ctrl.rateLockPage(token, res);
    expect(getStatus()).toBe(404);
    const sqlCalls = query.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.some((s) => /UPDATE payment_sessions/.test(s))).toBe(false);
  });

  it('returns 401 when DB session row is missing (forged jti)', async () => {
    const token = signPaymentToken(makeClaims());
    const { pool } = makeMockPool([
      { rows: [{ razorpay_order_id: 'rzp_ord_1', deposit_amount_paise: '50000', status: 'PENDING_PAYMENT' }] },
      { rows: [{ display_name: 'Test Jeweller', status: 'ACTIVE' }] },
      { rows: [] }, // session row missing
    ]);
    const ctrl = new PaymentController(pool);
    const { res, getStatus } = makeRes();
    await ctrl.rateLockPage(token, res);
    expect(getStatus()).toBe(401);
  });
});
