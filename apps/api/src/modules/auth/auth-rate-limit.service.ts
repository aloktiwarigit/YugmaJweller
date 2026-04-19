import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

export interface RateLimitCheck {
  ok: boolean;
  lockedUntil?: Date;
  retryAfterSeconds?: number;
  failures: number;
}

const HARD_LOCKOUT = 10;

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
      // DB-side atomic increment — eliminates TOCTOU concurrent-first-failure undercount.
      // The UPSERT is atomic so no SELECT FOR UPDATE / BEGIN needed.
      const res = await c.query<{ verify_failures: number; locked_until: Date | null }>(
        `INSERT INTO auth_rate_limits (phone_e164, verify_failures, window_started_at, locked_until)
         VALUES ($1, 1, now(), NULL)
         ON CONFLICT (phone_e164) DO UPDATE SET
           verify_failures   = CASE
             WHEN auth_rate_limits.window_started_at + interval '15 minutes' <= now() THEN 1
             ELSE auth_rate_limits.verify_failures + 1
           END,
           window_started_at = CASE
             WHEN auth_rate_limits.window_started_at + interval '15 minutes' <= now() THEN now()
             ELSE auth_rate_limits.window_started_at
           END,
           locked_until      = CASE
             WHEN (CASE
               WHEN auth_rate_limits.window_started_at + interval '15 minutes' <= now() THEN 1
               ELSE auth_rate_limits.verify_failures + 1
             END) >= 10
             THEN now() + interval '15 minutes'
             ELSE auth_rate_limits.locked_until
           END,
           updated_at        = now()
         RETURNING verify_failures, locked_until`,
        [phoneE164],
      );
      const row = res.rows[0];
      return {
        ok: row.verify_failures < HARD_LOCKOUT,
        lockedUntil: row.locked_until ?? undefined,
        failures: row.verify_failures,
      };
    } finally { c.release(); }
  }

  async recordSuccess(phoneE164: string): Promise<void> {
    const c = await this.pool.connect();
    try {
      await c.query(`DELETE FROM auth_rate_limits WHERE phone_e164 = $1`, [phoneE164]);
    } finally { c.release(); }
  }
}
