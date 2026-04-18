import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';
import { assertRlsInvariants } from '../src/schema-assertions';

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../db/src/migrations'));
}, 60_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

describe('assertRlsInvariants', () => {
  it('passes against freshly migrated schema', async () => {
    const result = await assertRlsInvariants(pool);
    if (!result.ok) console.error(result.failures);
    expect(result.ok).toBe(true);
  });
});
