import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';
import { provisionFixtures, runTenantIsolationHarness } from '../src';

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../db/src/migrations'));
  await provisionFixtures(pool);
}, 120_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

describe('tenant-isolation harness', () => {
  it('3 tenants isolate on every tenantScopedTable (invariants 12-13)', async () => {
    const r = await runTenantIsolationHarness(pool);
    if (!r.ok) console.error(r.failures);
    expect(r.ok).toBe(true);
  });
});
