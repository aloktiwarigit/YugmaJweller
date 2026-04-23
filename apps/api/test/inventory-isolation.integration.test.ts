import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

const SHOP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SHOP_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let productAId: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES
        ($1, 'shop-a', 'Shop A', 'ACTIVE'),
        ($2, 'shop-b', 'Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
  } finally {
    c.release();
  }

  const tenantA: Tenant = { id: SHOP_A, slug: 'shop-a', display_name: 'Shop A', status: 'ACTIVE' };
  const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };

  const row = await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'RING-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000', 'IN_STOCK', $1)
         RETURNING id`,
        [SHOP_A],
      );
      return r.rows[0];
    }),
  );
  productAId = row.id;
}, 120_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

describe('inventory tenant isolation', () => {
  it('tenant A can read its own product', async () => {
    const tenantA: Tenant = { id: SHOP_A, slug: 'shop-a', display_name: 'Shop A', status: 'ACTIVE' };
    const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
    const rows = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(`SELECT id FROM products WHERE id = $1`, [productAId]);
        return r.rows;
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(productAId);
  });

  it('tenant B cannot see tenant A product — RLS returns 0 rows', async () => {
    const tenantB: Tenant = { id: SHOP_B, slug: 'shop-b', display_name: 'Shop B', status: 'ACTIVE' };
    const ctxB: UnauthenticatedTenantContext = { shopId: SHOP_B, tenant: tenantB, authenticated: false };
    const rows = await tenantContext.runWith(ctxB, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(`SELECT id FROM products WHERE id = $1`, [productAId]);
        return r.rows;
      }),
    );
    expect(rows).toHaveLength(0);
  });
});
