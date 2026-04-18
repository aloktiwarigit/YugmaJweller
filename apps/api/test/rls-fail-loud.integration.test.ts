import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';

describe('RLS fail-loud (E2-S1 deferral closure)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
  }, 120_000);
  afterAll(async () => { await pool?.end(); await container?.stop(); });

  it('query without SET LOCAL on a connection without poison default raises 42704', async () => {
    const c = await pool.connect();
    try {
      await c.query('SET ROLE app_user');
      await c.query('RESET app.current_shop_id'); // wipe the poison default
      await expect(c.query('SELECT 1 FROM shop_users LIMIT 1'))
        .rejects.toMatchObject({ code: '42704' });
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  });

  it('poison-default connection without SET LOCAL returns zero rows (E2-S1 invariant #12 preserved)', async () => {
    const c = await pool.connect();
    try {
      await c.query('SET ROLE app_user');
      // Do NOT reset app.current_shop_id — pool's on-connect hook set the poison default.
      const res = await c.query('SELECT count(*)::int AS n FROM shop_users');
      expect((res.rows[0] as { n: number }).n).toBe(0);
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  });
});
