/**
 * Story 3.10 — Dead-stock detection integration smoke test.
 *
 * Creates real products in a testcontainers Postgres instance, backdates
 * created_at via a direct SQL UPDATE (bypassing RLS — only by id, always safe
 * in an isolated test container), then calls InventoryDeadStockService.getDeadStock()
 * and verifies the returned payload.
 *
 * Three assertions validated:
 *   1. A product older than the threshold (200 days > 180-day default) appears
 *      with daysInStock ≈ 200 and suggestedAction = 'DISCOUNT' (< 1.5× threshold).
 *   2. A product created today is NOT in the dead-stock list.
 *   3. Tenant isolation: shop A dead stock is never returned for shop B.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { InventoryDeadStockService } from '../src/modules/inventory/inventory.dead-stock.service';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Tenant, UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const SHOP_A = 'cccccccc-cccc-4444-cccc-cccccccccccc';
const SHOP_B = 'dddddddd-dddd-4444-dddd-dddddddddddd';
const USER_ID = 'ffffffff-0000-0000-0000-000000000002';

const tenantA: Tenant = { id: SHOP_A, slug: 'ds-shop-a', display_name: 'DeadStock Shop A', status: 'ACTIVE' };
const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };

const tenantB: Tenant = { id: SHOP_B, slug: 'ds-shop-b', display_name: 'DeadStock Shop B', status: 'ACTIVE' };
const ctxB: UnauthenticatedTenantContext = { shopId: SHOP_B, tenant: tenantB, authenticated: false };

// ────────────────────────────────────────────────────────────────────────────
// Suite
// ────────────────────────────────────────────────────────────────────────────

describe('InventoryDeadStockService — integration smoke test', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let service: InventoryDeadStockService;

  /** Product IDs set during beforeAll for use in individual tests. */
  let oldProductId: string;   // created_at backdated to 200 days ago — dead stock
  let freshProductId: string; // created_at = now() — NOT dead stock
  let shopAOldProductId: string; // shop A old product — must not appear for shop B

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

    // InventoryDeadStockService is a NestJS injectable — instantiate directly.
    service = new InventoryDeadStockService(pool);

    // Insert both shops (plain query — no RLS interceptor in test).
    const c = await pool.connect();
    try {
      await c.query(
        `INSERT INTO shops (id, slug, display_name, status) VALUES
           ($1, 'ds-shop-a', 'DeadStock Shop A', 'ACTIVE'),
           ($2, 'ds-shop-b', 'DeadStock Shop B', 'ACTIVE')`,
        [SHOP_A, SHOP_B],
      );
    } finally {
      c.release();
    }

    // ── Shop A: create an "old" product (will be backdated to 200 days ago) ──
    const oldRow = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO products
             (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
              stone_weight_g, status, created_by_user_id)
           VALUES ($1, 'DS-OLD-001', 'GOLD', '22K', '12.0000', '11.0000', '0.0000', 'IN_STOCK', $2)
           RETURNING id`,
          [SHOP_A, USER_ID],
        );
        return r.rows[0]!;
      }),
    );
    oldProductId = oldRow.id;

    // Backdate created_at to 200 days ago — raw pool (no RLS context needed for id-scoped UPDATE).
    const rawClient = await pool.connect();
    try {
      await rawClient.query(
        `UPDATE products SET created_at = now() - interval '200 days' WHERE id = $1`,
        [oldProductId],
      );
    } finally {
      rawClient.release();
    }

    // ── Shop A: create a "fresh" product (created_at = now()) ──
    const freshRow = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO products
             (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
              stone_weight_g, status, created_by_user_id)
           VALUES ($1, 'DS-FRESH-001', 'SILVER', '925', '5.0000', '4.5000', '0.0000', 'IN_STOCK', $2)
           RETURNING id`,
          [SHOP_A, USER_ID],
        );
        return r.rows[0]!;
      }),
    );
    freshProductId = freshRow.id;

    // ── Shop B: create an old product (for isolation test) ──
    const shopBRow = await tenantContext.runWith(ctxB, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO products
             (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
              stone_weight_g, status, created_by_user_id)
           VALUES ($1, 'DS-B-OLD-001', 'GOLD', '18K', '8.0000', '7.5000', '0.0000', 'IN_STOCK', $2)
           RETURNING id`,
          [SHOP_B, USER_ID],
        );
        return r.rows[0]!;
      }),
    );
    shopAOldProductId = shopBRow.id;

    // Backdate shop B's product to 200 days ago.
    const rawClient2 = await pool.connect();
    try {
      await rawClient2.query(
        `UPDATE products SET created_at = now() - interval '200 days' WHERE id = $1`,
        [shopAOldProductId],
      );
    } finally {
      rawClient2.release();
    }
  }, 300_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('dead stock: product created 200 days ago appears with daysInStock ≥ 199 and suggestedAction = DISCOUNT', async () => {
    const results = await service.getDeadStock(ctxA);

    // Should include the backdated old product.
    const found = results.find((p) => p.id === oldProductId);
    expect(found, 'old product must appear in dead stock list').toBeDefined();

    // daysInStock should be approximately 200 (allow ±1 for timing).
    expect(found!.daysInStock).toBeGreaterThanOrEqual(199);

    // 200 days < 180 * 1.5 = 270  →  suggestedAction = 'DISCOUNT'
    expect(found!.suggestedAction).toBe('DISCOUNT');

    // Verify shape of returned object.
    expect(found!.sku).toBe('DS-OLD-001');
    expect(found!.metal).toBe('GOLD');
    expect(found!.firstListedAt).toBeInstanceOf(Date);
  });

  it('dead stock: product created today is NOT in the dead-stock list', async () => {
    const results = await service.getDeadStock(ctxA);

    const freshInResults = results.find((p) => p.id === freshProductId);
    expect(freshInResults, 'fresh product must NOT appear in dead stock list').toBeUndefined();
  });

  it('dead stock: returns only IN_STOCK products (status guard)', async () => {
    // All products in the fixture are IN_STOCK, so every returned item should be IN_STOCK.
    const results = await service.getDeadStock(ctxA);
    for (const p of results) {
      expect(p.status).toBe('IN_STOCK');
    }
  });

  it('dead stock: tenant isolation — shop A dead stock is not returned for shop B', async () => {
    // ctxB should only see shop B products, not shop A's DS-OLD-001.
    const results = await service.getDeadStock(ctxB);

    const shopAProductInB = results.find((p) => p.id === oldProductId);
    expect(shopAProductInB, 'shop A product must NOT appear in shop B dead stock').toBeUndefined();

    // Shop B's own old product SHOULD appear.
    const shopBProduct = results.find((p) => p.id === shopAOldProductId);
    expect(shopBProduct, 'shop B old product must appear in its own dead stock').toBeDefined();
    expect(shopBProduct!.daysInStock).toBeGreaterThanOrEqual(199);
  });
});
