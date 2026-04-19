import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

export interface RateLimitCheck {
  ok: boolean;
  lockedUntil?: Date;
  retryAfterSeconds?: number;
  failures: number;
}

const WINDOW_MS    = 15 * 60 * 1000;
const HARD_LOCKOUT = 10;
const LOCKOUT_MS   = 15 * 60 * 1000;

@Injectable()
export class AuthRateLimitService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async check(phoneE164: string): Promise<RateLimitCheck> {
    const c = await this.pool.connect();
    try {
      const res = await c.query<{ verify_failures: number; window_started_at: Date; locked_until: Date | null }>(
        `SELECT verify_failures, window_started_at, locked_until FROM auth_rate_limits WHERE phone_e164 = $1`,
        [phoneE164],
      );
      const row = res.rows[0];
      if (!row) return { ok: true, failures: 0 };
      if (row.locked_until && row.locked_until > new Date()) {
        const retry = Math.ceil((row.locked_until.getTime() - Date.now()) / 1000);
        return { ok: false, lockedUntil: row.locked_until, retryAfterSeconds: retry, failures: row.verify_failures };
      }
      return { ok: true, failures: row.verify_failures };
    } finally { c.release(); }
  }

  async recordFailure(phoneE164: string): Promise<RateLimitCheck> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const existing = await c.query<{ verify_failures: number; window_started_at: Date }>(
        `SELECT verify_failures, window_started_at FROM auth_rate_limits WHERE phone_e164 = $1 FOR UPDATE`,
        [phoneE164],
      );
      let failures = 1;
      if (existing.rows[0]) {
        const windowExpired = Date.now() - existing.rows[0].window_started_at.getTime() > WINDOW_MS;
        failures = windowExpired ? 1 : existing.rows[0].verify_failures + 1;
      }
      const lockedUntil = failures >= HARD_LOCKOUT ? new Date(Date.now() + LOCKOUT_MS) : null;
      await c.query(
        `INSERT INTO auth_rate_limits (phone_e164, verify_failures, window_started_at, locked_until)
         VALUES ($1, $2, now(), $3)
         ON CONFLICT (phone_e164) DO UPDATE SET
           verify_failures   = EXCLUDED.verify_failures,
           window_started_at = CASE WHEN auth_rate_limits.window_started_at + interval '15 minutes' < now()
                                    THEN now() ELSE auth_rate_limits.window_started_at END,
           locked_until      = EXCLUDED.locked_until,
           updated_at        = now()`,
        [phoneE164, failures, lockedUntil],
      );
      await c.query('COMMIT');
      return { ok: failures < HARD_LOCKOUT, lockedUntil: lockedUntil ?? undefined, failures };
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally { c.release(); }
  }

  async recordSuccess(phoneE164: string): Promise<void> {
    const c = await this.pool.connect();
    try {
      await c.query(`DELETE FROM auth_rate_limits WHERE phone_e164 = $1`, [phoneE164]);
    } finally { c.release(); }
  }
}
