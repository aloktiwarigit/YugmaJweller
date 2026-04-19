import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { createPool, runMigrations } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
import { auditLog } from '../src/audit-log';

const A = '11111111-1111-1111-1111-111111111111';
const tenantA: Tenant = { id: A, slug: 'a', display_name: 'A', status: 'ACTIVE' };
const ctxA: UnauthenticatedTenantContext = { shopId: A, tenant: tenantA, authenticated: false };
let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  // Resolve from this file's location up two levels to monorepo root, then into packages/db
  const migrationsDir = resolve(__dirname, '../../db/src/migrations');
  await runMigrations(pool, migrationsDir);
  const c = await pool.connect();
  await c.query(`INSERT INTO shops (id, slug, display_name, status) VALUES ('${A}', 'a', 'A', 'ACTIVE');`);
  c.release();
}, 60_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

describe('auditLog', () => {
  it('inserts a row under the current tenant', async () => {
    await tenantContext.runWith(ctxA, () =>
      auditLog(pool, { action: 'test.happened', subjectType: 'demo', subjectId: 'x', before: null, after: { ok: true } }),
    );
    const c = await pool.connect();
    await c.query(`SET ROLE app_user; SET app.current_shop_id='${A}';`);
    const { rows } = await c.query('SELECT action FROM audit_events');
    expect(rows.some((r: { action: string }) => r.action === 'test.happened')).toBe(true);
    await c.query('RESET ROLE');
    c.release();
  });

  it('throws outside a tenant context', async () => {
    await expect(auditLog(pool, { action: 'x', subjectType: 'y' })).rejects.toThrow(/tenant\.context_not_set/);
  });
});
