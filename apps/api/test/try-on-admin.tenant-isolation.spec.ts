/**
 * Plan 3 Task 4 — Tenant isolation for the shopkeeper try-on-asset admin API.
 *
 * Mirrors product-images.tenant-isolation.spec.ts: instantiate InventoryService
 * directly (no NestJS bootstrap), inject TenantContext via tenantContext.runWith,
 * and assert RLS hides shop A's product_try_on_assets row from shop B.
 *
 * Assertions:
 *   - shop A reads its own ready+enabled asset.
 *   - shop B getTryOnAsset on shop A's product → NotFoundException (RLS hides it).
 *   - shop B updateTryOnAsset on shop A's product → NotFoundException.
 *   - shop A cannot enable an asset whose cutout is not 'ready' (ready-guard).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import {
  tenantContext,
  type Tenant,
  type AuthenticatedTenantContext,
} from '@goldsmith/tenant-context';
import { ImageKitTransformUrlBuilder } from '@goldsmith/integrations-storage';
import { SyncLogger } from '@goldsmith/sync';
import { NotFoundException } from '@nestjs/common';
import { InventoryRepository } from '../src/modules/inventory/inventory.repository';
import { InventoryService } from '../src/modules/inventory/inventory.service';

// Fixture UUIDs — non-overlapping with other test files.
const SHOP_A = 'aa700001-aa00-4000-aa00-000000000071';
const SHOP_B = 'bb700002-bb00-4000-bb00-000000000072';

const tenantAFull: Tenant = { id: SHOP_A, slug: 'to-shop-a', display_name: 'TO Shop A', status: 'ACTIVE' };
const tenantBFull: Tenant = { id: SHOP_B, slug: 'to-shop-b', display_name: 'TO Shop B', status: 'ACTIVE' };

const ctxA: AuthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantAFull, authenticated: true, userId: SHOP_A, role: 'shop_admin' };
const ctxB: AuthenticatedTenantContext = { shopId: SHOP_B, tenant: tenantBFull, authenticated: true, userId: SHOP_B, role: 'shop_admin' };

function runAs<T>(ctx: AuthenticatedTenantContext, fn: () => Promise<T>): Promise<T> {
  return Promise.resolve(tenantContext.runWith(ctx, fn));
}

let container: StartedPostgreSqlContainer;
let pool: Pool;
let inventoryService: InventoryService;
let productAId: string;
let productA2Id: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed shops (raw connection, bypasses RLS).
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES
        ($1, 'to-shop-a', 'TO Shop A', 'ACTIVE'),
        ($2, 'to-shop-b', 'TO Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
    await c.query(
      `INSERT INTO shop_users (id, shop_id, phone, display_name, role, status)
         VALUES ($1, $2, '+919000007001', 'Owner A', 'shop_admin', 'ACTIVE')`,
      [SHOP_A, SHOP_A],
    );
  } finally {
    c.release();
  }

  // Seed two SHOP_A products + assets: A = ready+enabled, A2 = pending.
  await runAs(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const a = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id, published_at)
         VALUES ($1, 'TO-A-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000', 'IN_STOCK', $2, now())
         RETURNING id`,
        [SHOP_A, SHOP_A],
      );
      productAId = a.rows[0]!.id;
      await tx.query(
        `INSERT INTO product_try_on_assets (shop_id, product_id, body_part, asset_storage_key, status, enabled)
           VALUES ($1, $2, 'EAR', 'shopA/p.cutout.png', 'ready', true)`,
        [SHOP_A, productAId],
      );

      const a2 = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'TO-A-002', 'GOLD', '22K', '8.0000', '7.5000', '0.0000', 'IN_STOCK', $2)
         RETURNING id`,
        [SHOP_A, SHOP_A],
      );
      productA2Id = a2.rows[0]!.id;
      await tx.query(
        `INSERT INTO product_try_on_assets (shop_id, product_id, body_part, status, enabled)
           VALUES ($1, $2, 'FINGER', 'pending', false)`,
        [SHOP_A, productA2Id],
      );
    }),
  );

  const repo = new InventoryRepository(pool as never, new SyncLogger());
  inventoryService = new InventoryService(repo, pool as never, new ImageKitTransformUrlBuilder());
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('try-on admin — cross-tenant isolation', () => {
  it('shop A reads its own asset', async () => {
    const r = await runAs(ctxA, () => inventoryService.getTryOnAsset(productAId));
    expect(r.bodyPart).toBe('EAR');
    expect(r.enabled).toBe(true);
  });

  it('shop B getTryOnAsset on shop A product → NotFound (RLS hides the row)', async () => {
    await expect(runAs(ctxB, () => inventoryService.getTryOnAsset(productAId)))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('shop B updateTryOnAsset on shop A product → NotFound (no visible row to update)', async () => {
    await expect(
      runAs(ctxB, () => inventoryService.updateTryOnAsset(productAId, { anchorX: 0.9, anchorY: 0.9, enabled: true })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('shop A cannot enable an asset whose cutout is not ready (ready-guard)', async () => {
    const r = await runAs(ctxA, () => inventoryService.updateTryOnAsset(productA2Id, { anchorX: 0.5, anchorY: 0.5, enabled: true }));
    expect(r.enabled).toBe(false);
    expect(r.status).toBe('pending');
  });
});
