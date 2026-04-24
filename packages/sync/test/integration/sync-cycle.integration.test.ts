// Full pull-push cycle integration test with real Postgres.
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
const SHOP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PRODUCT_2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const ctx = {
  shopId: SHOP_ID,
  tenant: { id: SHOP_ID, slug: 'sync-shop', display_name: 'Sync Shop', status: 'ACTIVE' as const },
  authenticated: false as const,
};

let container: StartedPostgreSqlContainer;
let pool: Pool;
const syncLogger = new SyncLogger();

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, MIGRATIONS_DIR);
  await pool.query(
    `INSERT INTO shops (id, slug, display_name, status) VALUES ($1,'sync-shop','Sync Shop','ACTIVE')`,
    [SHOP_ID],
  );
  await pool.query(
    `INSERT INTO tenant_sync_cursors (shop_id, cursor) VALUES ($1, 0)`,
    [SHOP_ID],
  );
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('Sync cycle — pull returns logged changes', () => {
  it('pull(lastCursor=0) returns a product logged via SyncLogger', async () => {
    await tenantContext.runWith(ctx, () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(
          `INSERT INTO products
             (id, shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
              stone_weight_g, status, created_by_user_id)
           VALUES ($1,$2,'SKU001','GOLD','22K','10.000','9.500','0.000','IN_STOCK',gen_random_uuid())`,
          [PRODUCT_1, SHOP_ID],
        );
        await syncLogger.logInTx(tx, SHOP_ID, 'products', PRODUCT_1, 'INSERT', {
          id: PRODUCT_1, sku: 'SKU001',
        });
      }),
    );

    const result = await tenantContext.runWith(ctx, () =>
      pull(pool, ctx, { lastCursor: 0n, tables: ['products'] }),
    );

    expect(result.changes['products']!.created).toHaveLength(1);
    expect(result.changes['products']!.created[0]).toMatchObject({ id: PRODUCT_1, sku: 'SKU001' });
    expect(result.cursor).toBeGreaterThan(0n);
  });

  it('incremental pull returns only new rows since lastCursor', async () => {
    const firstPull = await tenantContext.runWith(ctx, () =>
      pull(pool, ctx, { lastCursor: 0n, tables: ['products'] }),
    );
    const cursorAfterFirst = firstPull.cursor;

    await tenantContext.runWith(ctx, () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(
          `INSERT INTO products
             (id, shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
              stone_weight_g, status, created_by_user_id)
           VALUES ($1,$2,'SKU002','SILVER','999','5.000','4.800','0.000','IN_STOCK',gen_random_uuid())`,
          [PRODUCT_2, SHOP_ID],
        );
        await syncLogger.logInTx(tx, SHOP_ID, 'products', PRODUCT_2, 'INSERT', {
          id: PRODUCT_2, sku: 'SKU002',
        });
      }),
    );

    const secondPull = await tenantContext.runWith(ctx, () =>
      pull(pool, ctx, { lastCursor: cursorAfterFirst, tables: ['products'] }),
    );

    expect(secondPull.changes['products']!.created).toHaveLength(1);
    expect(secondPull.changes['products']!.created[0]).toMatchObject({ sku: 'SKU002' });
    expect(secondPull.cursor).toBeGreaterThan(cursorAfterFirst);
  });
});
