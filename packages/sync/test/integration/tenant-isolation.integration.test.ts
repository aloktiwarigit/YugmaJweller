// Tenant isolation test — 3-tenant harness.
// Verifies that Shop B and Shop C pull returns ZERO rows from Shop A's data.
// Requires Docker (Testcontainers).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Pool } from 'pg';
import { resolve } from 'path';
import { pull } from '../../src/server/pull';
import { SyncLogger } from '../../src/server/sync-logger';

const MIGRATIONS_DIR = resolve(__dirname, '../../../../packages/db/src/migrations');

const SHOP_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const SHOP_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const SHOP_C = 'cccccccc-0000-0000-0000-000000000003';
const PRODUCT_A = 'dddddddd-0000-0000-0000-000000000004';

const makeCtx = (shopId: string, slug: string) => ({
  shopId,
  tenant: { id: shopId, slug, display_name: 'Test', status: 'ACTIVE' as const },
  authenticated: false as const,
});

const ctxA = makeCtx(SHOP_A, 'shop-a');
const ctxB = makeCtx(SHOP_B, 'shop-b');
const ctxC = makeCtx(SHOP_C, 'shop-c');

let container: StartedPostgreSqlContainer;
let pool: Pool;
const syncLogger = new SyncLogger();

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, MIGRATIONS_DIR);

  const shops = [[SHOP_A, 'shop-a'], [SHOP_B, 'shop-b'], [SHOP_C, 'shop-c']];
  for (const pair of shops) {
    const shopId = pair[0] as string;
    const slug = pair[1] as string;
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1,$2,'Test','ACTIVE')`,
      [shopId, slug],
    );
    await pool.query(
      `INSERT INTO tenant_sync_cursors (shop_id, cursor) VALUES ($1, 0)`,
      [shopId],
    );
  }

  // Seed one product + change log entry for Shop A only
  await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      await tx.query(
        `INSERT INTO products
           (id, shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
            stone_weight_g, status, created_by_user_id)
         VALUES ($1,$2,'SKU-A','GOLD','22K','10.000','9.500','0.000','IN_STOCK',gen_random_uuid())`,
        [PRODUCT_A, SHOP_A],
      );
      await syncLogger.logInTx(tx, SHOP_A, 'products', PRODUCT_A, 'INSERT', { id: PRODUCT_A });
    }),
  );
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('Tenant isolation', () => {
  it('Shop A pull returns its own product', async () => {
    const result = await tenantContext.runWith(ctxA, () =>
      pull(pool, ctxA, { lastCursor: 0n, tables: ['products'] }),
    );
    expect(result.changes['products']!.created).toHaveLength(1);
  });

  it('Shop B pull returns ZERO rows — no cross-tenant leakage from Shop A', async () => {
    const result = await tenantContext.runWith(ctxB, () =>
      pull(pool, ctxB, { lastCursor: 0n, tables: ['products'] }),
    );
    expect(result.changes['products']!.created).toHaveLength(0);
    expect(result.changes['products']!.updated).toHaveLength(0);
    expect(result.changes['products']!.deleted).toHaveLength(0);
  });

  it('Shop C pull returns ZERO rows — no cross-tenant leakage from Shop A', async () => {
    const result = await tenantContext.runWith(ctxC, () =>
      pull(pool, ctxC, { lastCursor: 0n, tables: ['products'] }),
    );
    expect(result.changes['products']!.created).toHaveLength(0);
  });
});
