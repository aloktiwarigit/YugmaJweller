import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';
import { AuthRateLimitService } from '../src/modules/auth/auth-rate-limit.service';

describe('AuthRateLimitService', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let svc: AuthRateLimitService;
  const PHONE = '+919000007001';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
    svc = new AuthRateLimitService(pool);
  }, 120_000);
  afterAll(async () => { await pool?.end(); await container?.stop(); });
  beforeEach(async () => { await pool.query('DELETE FROM auth_rate_limits'); });

  it('first check returns ok with 0 failures', async () => {
    await expect(svc.check(PHONE)).resolves.toMatchObject({ ok: true, failures: 0 });
  });

  it('9 failures still pass; 10th triggers lockout', async () => {
    for (let i = 0; i < 9; i++) {
      const r = await svc.recordFailure(PHONE);
      expect(r.ok).toBe(true);
    }
    const r = await svc.recordFailure(PHONE);
    expect(r.ok).toBe(false);
    expect(r.lockedUntil).toBeInstanceOf(Date);
  });

  it('locked phone returns 429-shaped check result with retryAfterSeconds', async () => {
    for (let i = 0; i < 10; i++) await svc.recordFailure(PHONE);
    const r = await svc.check(PHONE);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
    expect(r.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it('recordSuccess clears the row', async () => {
    for (let i = 0; i < 3; i++) await svc.recordFailure(PHONE);
    await svc.recordSuccess(PHONE);
    const res = await pool.query('SELECT 1 FROM auth_rate_limits WHERE phone_e164 = $1', [PHONE]);
    expect(res.rowCount).toBe(0);
  });

  it('rolling window resets on 15min rollover (simulated via UPDATE)', async () => {
    // Seed a row as if the window started 16 minutes ago
    await pool.query(
      `INSERT INTO auth_rate_limits (phone_e164, verify_failures, window_started_at)
       VALUES ($1, 8, now() - interval '16 minutes')`,
      [PHONE],
    );
    const r = await svc.recordFailure(PHONE);
    // Window expired → counter resets to 1
    expect(r.failures).toBe(1);
    expect(r.ok).toBe(true);
  });
});
