import { createHmac } from 'crypto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  signPaymentToken,
  verifyPaymentToken,
  createPaymentSession,
  consumePaymentSession,
  type PaymentTokenClaims,
} from './payment-token';

const BOOKING_ID  = 'b1111111-1111-1111-1111-111111111111';
const CUSTOMER_ID = 'c1111111-1111-1111-1111-111111111111';
const SHOP_ID     = 'd1111111-1111-1111-1111-111111111111';
const JTI         = 'e1111111-1111-1111-1111-111111111111';

function claims(overrides: Partial<PaymentTokenClaims> = {}): PaymentTokenClaims {
  return {
    jti:        JTI,
    bookingId:  BOOKING_ID,
    customerId: CUSTOMER_ID,
    shopId:     SHOP_ID,
    exp:        Date.now() + 5 * 60 * 1000,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('signPaymentToken + verifyPaymentToken', () => {
  it('round-trips a valid token', () => {
    const c        = claims();
    const token    = signPaymentToken(c);
    const verified = verifyPaymentToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.jti).toBe(JTI);
    expect(verified!.bookingId).toBe(BOOKING_ID);
    expect(verified!.customerId).toBe(CUSTOMER_ID);
    expect(verified!.shopId).toBe(SHOP_ID);
  });

  it('returns null for a tampered signature', () => {
    const token    = signPaymentToken(claims());
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(verifyPaymentToken(tampered)).toBeNull();
  });

  it('returns null for a token with no dot separator', () => {
    expect(verifyPaymentToken('notavalidtoken')).toBeNull();
  });

  it('returns null for an empty token string', () => {
    expect(verifyPaymentToken('')).toBeNull();
  });

  it('returns null for a malformed base64url payload', () => {
    expect(verifyPaymentToken('!!notbase64.signature')).toBeNull();
  });

  it('returns null for an expired token', () => {
    vi.useFakeTimers();
    const token = signPaymentToken(claims());
    vi.advanceTimersByTime(6 * 60 * 1000); // past 5-minute TTL
    expect(verifyPaymentToken(token)).toBeNull();
  });

  it('returns null when required claims are missing', () => {
    // Manually craft a token with missing customerId.
    const payload = { jti: JTI, bookingId: BOOKING_ID, shopId: SHOP_ID, exp: Date.now() + 60_000 };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const secret  = process.env['PAYMENT_TOKEN_SECRET'] ?? 'dev-only-secret-CHANGE-IN-PRODUCTION';
    const sig     = createHmac('sha256', secret).update(encoded).digest('base64url');
    expect(verifyPaymentToken(`${encoded}.${sig}`)).toBeNull();
  });
});

describe('signPaymentToken — production secret enforcement', () => {
  it('throws when PAYMENT_TOKEN_SECRET is missing in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAYMENT_TOKEN_SECRET', '');
    expect(() => signPaymentToken(claims())).toThrow('PAYMENT_TOKEN_SECRET');
  });

  it('throws when PAYMENT_TOKEN_SECRET is the default dev value in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAYMENT_TOKEN_SECRET', 'dev-only-secret-CHANGE-IN-PRODUCTION');
    expect(() => signPaymentToken(claims())).toThrow('PAYMENT_TOKEN_SECRET');
  });

  it('throws when PAYMENT_TOKEN_SECRET is shorter than 32 chars in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAYMENT_TOKEN_SECRET', 'tooshort');
    expect(() => signPaymentToken(claims())).toThrow('PAYMENT_TOKEN_SECRET');
  });

  it('succeeds when a strong secret is provided in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAYMENT_TOKEN_SECRET', 'a'.repeat(32));
    expect(() => signPaymentToken(claims())).not.toThrow();
  });
});

// ── DB-backed lifecycle ───────────────────────────────────────────────────────
//
// `withShopTx` falls through to the pool when the pool exposes no `.connect()`,
// so we can drive the session lifecycle with a plain mock `{ query: vi.fn() }`.
// See packages/db/src/tx.ts.

function makeMockPool() {
  const query = vi.fn();
  return { pool: { query } as unknown as import('pg').Pool, query };
}

describe('createPaymentSession', () => {
  it('inserts a row, returns a signed token whose jti matches the row id', async () => {
    const { pool, query } = makeMockPool();
    query.mockResolvedValueOnce({
      rows:     [{ id: JTI, expires_at: new Date(Date.now() + 5 * 60 * 1000) }],
      rowCount: 1,
    });

    const result = await createPaymentSession(pool, {
      bookingId:   BOOKING_ID,
      bookingType: 'RATE_LOCK',
      customerId:  CUSTOMER_ID,
      shopId:      SHOP_ID,
    });

    expect(result.jti).toBe(JTI);
    expect(result.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const verified = verifyPaymentToken(result.token);
    expect(verified).not.toBeNull();
    expect(verified!.jti).toBe(JTI);
    expect(verified!.bookingId).toBe(BOOKING_ID);
    expect(verified!.customerId).toBe(CUSTOMER_ID);
    expect(verified!.shopId).toBe(SHOP_ID);

    // INSERT was called with the right parameters.
    expect(query).toHaveBeenCalledTimes(1);
    const insertCall = query.mock.calls[0]!;
    expect(insertCall[0]).toMatch(/INSERT INTO payment_sessions/);
    expect(insertCall[1]).toEqual([SHOP_ID, CUSTOMER_ID, BOOKING_ID, 'RATE_LOCK', 5 * 60 * 1000]);
  });
});

describe('consumePaymentSession', () => {
  function mockTx(rows: Array<unknown[]>) {
    let i = 0;
    return {
      query: vi.fn().mockImplementation(() => {
        const r = rows[i++] ?? [];
        return Promise.resolve({ rows: r, rowCount: r.length });
      }),
    } as unknown as import('pg').PoolClient;
  }

  it('returns ok on first consume', async () => {
    const tx = mockTx([
      [{
        shop_id:      SHOP_ID,
        customer_id:  CUSTOMER_ID,
        booking_id:   BOOKING_ID,
        booking_type: 'RATE_LOCK',
        expires_at:   new Date(Date.now() + 5 * 60 * 1000),
        consumed_at:  null,
      }],
      [{ id: JTI }], // UPDATE ... RETURNING
    ]);
    const result = await consumePaymentSession(tx, claims());
    expect(result).toEqual({ ok: true });
  });

  it('rejects replay (already_consumed)', async () => {
    const tx = mockTx([
      [{
        shop_id:      SHOP_ID,
        customer_id:  CUSTOMER_ID,
        booking_id:   BOOKING_ID,
        booking_type: 'RATE_LOCK',
        expires_at:   new Date(Date.now() + 5 * 60 * 1000),
        consumed_at:  new Date(),
      }],
    ]);
    const result = await consumePaymentSession(tx, claims());
    expect(result).toEqual({ ok: false, reason: 'already_consumed' });
  });

  it('rejects when session expired in DB even if token claim is still in TTL', async () => {
    const tx = mockTx([
      [{
        shop_id:      SHOP_ID,
        customer_id:  CUSTOMER_ID,
        booking_id:   BOOKING_ID,
        booking_type: 'RATE_LOCK',
        expires_at:   new Date(Date.now() - 1000),
        consumed_at:  null,
      }],
    ]);
    const result = await consumePaymentSession(tx, claims());
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects when row is missing', async () => {
    const tx = mockTx([[]]); // SELECT returns nothing
    const result = await consumePaymentSession(tx, claims());
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects when claim shopId mismatches DB shopId (forged claim)', async () => {
    const tx = mockTx([
      [{
        shop_id:      'f0000000-0000-0000-0000-000000000000',
        customer_id:  CUSTOMER_ID,
        booking_id:   BOOKING_ID,
        booking_type: 'RATE_LOCK',
        expires_at:   new Date(Date.now() + 5 * 60 * 1000),
        consumed_at:  null,
      }],
    ]);
    const result = await consumePaymentSession(tx, claims());
    expect(result).toEqual({ ok: false, reason: 'claim_mismatch' });
  });

  it('rejects when claim customerId mismatches DB customerId', async () => {
    const tx = mockTx([
      [{
        shop_id:      SHOP_ID,
        customer_id:  'f0000000-0000-0000-0000-000000000000',
        booking_id:   BOOKING_ID,
        booking_type: 'RATE_LOCK',
        expires_at:   new Date(Date.now() + 5 * 60 * 1000),
        consumed_at:  null,
      }],
    ]);
    const result = await consumePaymentSession(tx, claims());
    expect(result).toEqual({ ok: false, reason: 'claim_mismatch' });
  });

  it('rejects when claim bookingId mismatches DB bookingId', async () => {
    const tx = mockTx([
      [{
        shop_id:      SHOP_ID,
        customer_id:  CUSTOMER_ID,
        booking_id:   'f0000000-0000-0000-0000-000000000000',
        booking_type: 'RATE_LOCK',
        expires_at:   new Date(Date.now() + 5 * 60 * 1000),
        consumed_at:  null,
      }],
    ]);
    const result = await consumePaymentSession(tx, claims());
    expect(result).toEqual({ ok: false, reason: 'claim_mismatch' });
  });

  it('treats concurrent consume race (UPDATE ... RETURNING 0 rows) as already_consumed', async () => {
    // Peek says not consumed, but the conditional UPDATE returns 0 rows
    // because a concurrent caller won the race.
    const tx = mockTx([
      [{
        shop_id:      SHOP_ID,
        customer_id:  CUSTOMER_ID,
        booking_id:   BOOKING_ID,
        booking_type: 'RATE_LOCK',
        expires_at:   new Date(Date.now() + 5 * 60 * 1000),
        consumed_at:  null,
      }],
      [],
    ]);
    const result = await consumePaymentSession(tx, claims());
    expect(result).toEqual({ ok: false, reason: 'already_consumed' });
  });
});
