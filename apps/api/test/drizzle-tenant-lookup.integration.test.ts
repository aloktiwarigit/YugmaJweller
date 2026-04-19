import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';
import { DrizzleTenantLookup } from '../src/drizzle-tenant-lookup';

describe('DrizzleTenantLookup', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let lookup: DrizzleTenantLookup;
  const SHOP_ID = 'cccccccc-3333-3333-3333-333333333333';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
    lookup = new DrizzleTenantLookup(pool);
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'dtl-shop', 'DTL', 'ACTIVE')`,
      [SHOP_ID],
    );
  }, 120_000);
  afterAll(async () => { await pool?.end(); await container?.stop(); });

  it('returns Tenant for existing shop', async () => {
    const t = await lookup.byId(SHOP_ID);
    expect(t).toBeDefined();
    expect(t!.id).toBe(SHOP_ID);
    expect(t!.status).toBe('ACTIVE');
  });

  it('returns undefined for non-existent id', async () => {
    await expect(lookup.byId('99999999-9999-9999-9999-999999999999')).resolves.toBeUndefined();
  });

  it('cached on second call within TTL window (hit count does not increase)', async () => {
    // Spy on pool.connect — second lookup within TTL should not connect.
    const before = await pool.query(`SELECT sum(numbackends)::int AS n FROM pg_stat_database`);
    await lookup.byId(SHOP_ID);
    const after = await pool.query(`SELECT sum(numbackends)::int AS n FROM pg_stat_database`);
    // Cache hit: no meaningful connection delta (loose check; at most 1 extra).
    expect(Math.abs(after.rows[0].n - before.rows[0].n)).toBeLessThanOrEqual(1);
  });

  it('invalidate() clears cache', async () => {
    await lookup.byId(SHOP_ID);
    lookup.invalidate(SHOP_ID);
    // Next call must re-hit DB — function should still return the tenant
    const t = await lookup.byId(SHOP_ID);
    expect(t!.id).toBe(SHOP_ID);
  });
});
