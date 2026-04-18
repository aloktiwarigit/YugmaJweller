import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';

describe('RLS fail-loud (E2-S1 deferral closure)', () => {
  let container: StartedPostgreSqlContainer;
  let poisonedPool: Pool; // uses createPool → on-connect sets poison-default GUC
  let rawPool: Pool;      // bypasses on-connect hook → GUC is never set

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    // Use a poisoned pool (createPool) to run migrations and exercise invariant #12.
    poisonedPool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(poisonedPool, resolve(__dirname, '../../../packages/db/src/migrations'));
    // Raw pool: new Pool directly (no on-connect poison-default hook).
    rawPool = new Pool({ connectionString: container.getConnectionUri() });
  }, 120_000);
  afterAll(async () => {
    await rawPool?.end();
    await poisonedPool?.end();
    await container?.stop();
  });

  it('query without SET LOCAL on a connection without poison default raises 42704', async () => {
    // Raw pool: connection has never run `SET app.current_shop_id`, so the GUC is
    // literally unrecognized. With missok=false (0004_rls_fail_loud.sql), the policy
    // predicate raises 42704 instead of silently returning zero rows.
    const c = await rawPool.connect();
    try {
      await c.query('SET ROLE app_user');
      await expect(c.query('SELECT 1 FROM shop_users LIMIT 1'))
        .rejects.toMatchObject({ code: '42704' });
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  });

  it('poison-default connection without SET LOCAL returns zero rows (E2-S1 invariant #12 preserved)', async () => {
    // Poisoned pool: on-connect hook SET app.current_shop_id to POISON_UUID, which
    // matches no real tenant rows. Query succeeds and returns 0.
    const c = await poisonedPool.connect();
    try {
      await c.query('SET ROLE app_user');
      const res = await c.query('SELECT count(*)::int AS n FROM shop_users');
      expect((res.rows[0] as { n: number }).n).toBe(0);
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  });
});
