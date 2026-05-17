import { createHmac, timingSafeEqual } from 'crypto';
import type { Pool, PoolClient } from 'pg';
import { withShopTx } from '@goldsmith/db';

// ---------------------------------------------------------------------------
// Payment-link tokens.
//
// A payment link is a short-lived URL the mobile app hands to the customer's
// browser to open a Razorpay checkout. To be enterprise-grade single-use,
// replay protection must:
//   1. survive API restarts (Cloud Run cold-starts the container constantly)
//   2. work across multiple horizontally-scaled API instances
//   3. consume the token ONLY after every downstream invariant
//      (booking ownership/status, Razorpay order id present, shop ACTIVE)
//      has been validated — in the same transaction as the consume itself
//
// Design: the token is a signed envelope `payload.sig`. The payload contains a
// `jti` that is the primary key of a row in `payment_sessions` (migration
// 0074). Consumption is `UPDATE ... WHERE id=$jti AND consumed_at IS NULL
// RETURNING id` — atomic, durable, cross-instance.
//
// The HMAC signature stops anyone from forging or tampering with `jti` (or any
// other claim). The DB row stops replay; expiry is checked against the row's
// `expires_at`, not just the token claim, so even a leaked secret that lets an
// attacker forge a token still fails on first replay or first miss against the
// authoritative row.
// ---------------------------------------------------------------------------

export interface PaymentTokenClaims {
  jti:        string; // payment_sessions.id (UUID)
  bookingId:  string;
  customerId: string;
  shopId:     string;
  exp:        number; // ms-since-epoch
}

export const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_DEV_SECRET = 'dev-only-secret-CHANGE-IN-PRODUCTION';

function getSecret(): string {
  return process.env['PAYMENT_TOKEN_SECRET'] ?? DEFAULT_DEV_SECRET;
}

export function assertProductionSecrets(): void {
  if (process.env['NODE_ENV'] !== 'production') return;
  const secret = process.env['PAYMENT_TOKEN_SECRET'];
  if (!secret || secret === DEFAULT_DEV_SECRET || secret.length < 32) {
    throw new Error(
      '[payment-token] PAYMENT_TOKEN_SECRET must be a strong random secret (≥32 chars) in production. ' +
      'Set it via an environment variable or secret manager before deploying.',
    );
  }
}

// ── Pure signing/verification ────────────────────────────────────────────────
// No DB, no I/O — safe to test in isolation and to call from hot paths.

export function signPaymentToken(claims: PaymentTokenClaims): string {
  assertProductionSecrets();
  const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyPaymentToken(token: string): PaymentTokenClaims | null {
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx < 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig     = token.slice(dotIdx + 1);
  if (!encoded || !sig) return null;

  const expectedSig = createHmac('sha256', getSecret()).update(encoded).digest('base64url');

  const sigBuf    = Buffer.from(sig, 'base64url');
  const expSigBuf = Buffer.from(expectedSig, 'base64url');
  if (sigBuf.length !== expSigBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expSigBuf)) return null;

  let claims: PaymentTokenClaims;
  try {
    claims = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as PaymentTokenClaims;
  } catch {
    return null;
  }

  if (typeof claims.exp !== 'number' || Date.now() > claims.exp) return null;
  if (!claims.jti || !claims.bookingId || !claims.customerId || !claims.shopId) return null;

  return claims;
}

// ── Durable session lifecycle ────────────────────────────────────────────────

export type BookingType = 'RATE_LOCK';

export interface CreateSessionParams {
  bookingId:   string;
  bookingType: BookingType;
  customerId:  string;
  shopId:      string;
  ttlMs?:      number;
}

/**
 * Create a `payment_sessions` row and return a signed token whose `jti`
 * matches the row id. Runs inside a tenant-scoped (RLS) transaction so the
 * row is correctly attributed even with multiple shops sharing the pool.
 */
export async function createPaymentSession(
  pool: Pool,
  params: CreateSessionParams,
): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const ttlMs = params.ttlMs ?? TOKEN_TTL_MS;

  const row = await withShopTx(pool, params.shopId, async (tx) => {
    const insert = await tx.query<{ id: string; expires_at: Date }>(
      `INSERT INTO payment_sessions
         (shop_id, customer_id, booking_id, booking_type, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5::bigint || ' milliseconds')::interval)
       RETURNING id, expires_at`,
      [params.shopId, params.customerId, params.bookingId, params.bookingType, ttlMs],
    );
    const r = insert.rows[0];
    if (!r) throw new Error('payment_sessions.insert_failed');
    return r;
  });

  const claims: PaymentTokenClaims = {
    jti:        row.id,
    bookingId:  params.bookingId,
    customerId: params.customerId,
    shopId:     params.shopId,
    exp:        row.expires_at.getTime(),
  };
  return { token: signPaymentToken(claims), jti: row.id, expiresAt: row.expires_at };
}

export interface ConsumeResult {
  ok:        boolean;
  reason?:   'invalid' | 'expired' | 'already_consumed' | 'claim_mismatch';
}

/**
 * Atomic consume. Runs inside the caller's transaction (which must already
 * have `app.current_shop_id` set, e.g. via withShopTx). All booking/shop
 * validations must have run before this in the same transaction; this call
 * is the commit-point that prevents replay.
 *
 * Returns `{ ok: false, reason: 'already_consumed' }` if the row exists but
 * has been consumed (or is expired); `{ ok: false, reason: 'invalid' }` if
 * the row is missing or shop_id mismatches; `{ ok: false, reason:
 * 'claim_mismatch' }` if the signed claims don't match the stored row;
 * `{ ok: true }` on first successful consume.
 */
export async function consumePaymentSession(
  tx:     PoolClient,
  claims: PaymentTokenClaims,
): Promise<ConsumeResult> {
  const peek = await tx.query<{
    shop_id: string;
    customer_id: string;
    booking_id: string;
    booking_type: string;
    expires_at: Date;
    consumed_at: Date | null;
  }>(
    `SELECT shop_id, customer_id, booking_id, booking_type, expires_at, consumed_at
       FROM payment_sessions
      WHERE id = $1
      FOR UPDATE`,
    [claims.jti],
  );
  const row = peek.rows[0];
  if (!row) return { ok: false, reason: 'invalid' };

  if (row.shop_id     !== claims.shopId)     return { ok: false, reason: 'claim_mismatch' };
  if (row.customer_id !== claims.customerId) return { ok: false, reason: 'claim_mismatch' };
  if (row.booking_id  !== claims.bookingId)  return { ok: false, reason: 'claim_mismatch' };

  if (row.consumed_at !== null) return { ok: false, reason: 'already_consumed' };
  if (row.expires_at.getTime() <= Date.now()) return { ok: false, reason: 'expired' };

  const upd = await tx.query<{ id: string }>(
    `UPDATE payment_sessions
        SET consumed_at = NOW()
      WHERE id = $1
        AND consumed_at IS NULL
        AND expires_at  > NOW()
      RETURNING id`,
    [claims.jti],
  );
  if ((upd.rowCount ?? 0) === 0) return { ok: false, reason: 'already_consumed' };
  return { ok: true };
}
