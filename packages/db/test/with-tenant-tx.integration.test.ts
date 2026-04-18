import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { createPool } from '../src/provider';
import { withTenantTx } from '../src/tx';
import { tenantContext } from '@goldsmith/tenant-context';

let container: StartedPostgreSqlContainer;
let pool: Pool;
const SHOP_A = '11111111-1111-1111-1111-111111111111';
const SHOP_B = '22222222-2222-2222-2222-222222222222';

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  const c = await pool.connect();
  for (const f of ['0000_roles.sql', '0001_initial_schema.sql', '0002_grants.sql']) {
    await c.query(readFileSync(join(__dirname, `../src/migrations/${f}`), 'utf8'));
  }
  await c.query(`INSERT INTO shops (id, slug, display_name, status) VALUES
    ('${SHOP_A}','a','Shop A','ACTIVE'),
    ('${SHOP_B}','b','Shop B','ACTIVE');`);
  await c.query(`
    SET ROLE app_user;
    SET app.current_shop_id = '${SHOP_A}';
    INSERT INTO shop_users (shop_id, phone, display_name, role, status)
      VALUES ('${SHOP_A}', '+91a', 'Alice A', 'shop_admin', 'ACTIVE');
    SET app.current_shop_id = '${SHOP_B}';
    INSERT INTO shop_users (shop_id, phone, display_name, role, status)
      VALUES ('${SHOP_B}', '+91b', 'Bob B', 'shop_admin', 'ACTIVE');
    RESET ROLE;
  `);
  c.release();
}, 60_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

describe('withTenantTx', () => {
  it('scopes SELECT to ALS tenant', async () => {
    const rows = await tenantContext.runWith({ shopId: SHOP_A } as never, () =>
      withTenantTx(pool, async (tx) => (await tx.query('SELECT * FROM shop_users')).rows),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].shop_id).toBe(SHOP_A);
  });

  it('throws when called outside runWith', async () => {
    await expect(withTenantTx(pool, async () => undefined)).rejects.toThrow(
      /tenant\.context_not_set/,
    );
  });

  it('rolls back on error + leaves SET LOCAL unleaked', async () => {
    await tenantContext.runWith({ shopId: SHOP_A } as never, async () => {
      await expect(
        withTenantTx(pool, async (tx) => {
          await tx.query('INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES ($1,$2,$3,$4,$5)',
            [SHOP_A, '+91c', 'X', 'shop_staff', 'ACTIVE']);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
    });
    // Fresh conn, no tenant set → poison-default. Must SET ROLE app_user so RLS applies
    // (superusers bypass RLS even with FORCE; app_user is NOBYPASSRLS).
    const c = await pool.connect();
    await c.query('SET ROLE app_user');
    const { rows } = await c.query('SELECT * FROM shop_users');
    expect(rows).toHaveLength(0);
    await c.query('RESET ROLE');
    c.release();
  });
});
