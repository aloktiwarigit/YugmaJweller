/**
 * VTO Plan 1 Task 17 — Tenant isolation: product_try_on_assets are not readable
 * across tenant boundaries via the catalog try-on endpoint.
 *
 * Approach: bootstrap CatalogService directly (no NestJS container). Seed a
 * published product + enabled/ready try-on asset in SHOP_A, then verify SHOP_B
 * cannot read it via withShopTx (RLS guard).
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
import { NotFoundException } from '@nestjs/common';
import { CatalogService } from '../src/modules/catalog/catalog.service';

// ---------------------------------------------------------------------------
// Fixture UUIDs — non-overlapping with other isolation test files
// ---------------------------------------------------------------------------

const SHOP_A = 'aa200001-aa00-4000-aa00-000000000011';
const SHOP_B = 'bb200002-bb00-4000-bb00-000000000022';

const tenantAFull: Tenant = { id: SHOP_A, slug: 'vto-shop-a', display_name: 'VTO Shop A', status: 'ACTIVE' };

const ctxA: AuthenticatedTenantContext = {
  shopId: SHOP_A,
  tenant: tenantAFull,
  authenticated: true,
  userId: SHOP_A,
  role: 'shop_admin',
};

// ---------------------------------------------------------------------------
// Shared infrastructure
// ---------------------------------------------------------------------------

let container: StartedPostgreSqlContainer;
let pool: Pool;
let catalogService: CatalogService;
let productAId: string;

const stubUrlBuilder = {
  url: (key: string) => `https://cdn.example.com/${key}`,
  srcset: (key: string) => `https://cdn.example.com/${key} 1x`,
  cardSrcset: (key: string) => `https://cdn.example.com/${key} 1x`,
};

const stubPricingService = { getCurrentRates: async () => ({}) };
const stubSettingsRepo = { getReturnPolicy: async () => null };

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed two shops via superuser connection (no RLS active yet)
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES
        ($1, 'vto-shop-a', 'VTO Shop A', 'ACTIVE'),
        ($2, 'vto-shop-b', 'VTO Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
  } finally {
    c.release();
  }

  // Seed a shop_admin user for SHOP_A (FK for created_by_user_id)
  await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      await tx.query(
        `INSERT INTO shop_users (id, shop_id, phone, display_name, role, status)
           VALUES ($1, $2, '+919000002001', 'Owner A', 'shop_admin', 'ACTIVE')`,
        [SHOP_A, SHOP_A],
      );
    }),
  );

  // Seed a published product in SHOP_A + enabled/ready try-on asset
  productAId = await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g,
            status, created_by_user_id, published_at)
         VALUES ($1, 'VTO-A-001', 'GOLD', '22K', '5.0000', '4.5000', '0.0000',
                 'IN_STOCK', $2, now())
         RETURNING id`,
        [SHOP_A, SHOP_A],
      );
      const prodId = r.rows[0]!.id;

      await tx.query(
        `INSERT INTO product_try_on_assets
           (shop_id, product_id, body_part, status, enabled)
         VALUES ($1, $2, 'EAR', 'ready', true)`,
        [SHOP_A, prodId],
      );

      return prodId;
    }),
  );

  catalogService = new CatalogService(
    pool as never,
    stubPricingService as never,
    stubSettingsRepo as never,
    stubUrlBuilder as never,
  );
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('try-on — cross-tenant isolation', () => {
  it('SHOP_B getTryOn on SHOP_A product → NotFoundException', async () => {
    await expect(catalogService.getTryOn(productAId, SHOP_B)).rejects.toThrow(NotFoundException);
  });

  it('SHOP_A getTryOn on its own product → returns the asset', async () => {
    const r = await catalogService.getTryOn(productAId, SHOP_A);
    expect(r.productId).toBe(productAId);
    expect(r.bodyPart).toBe('EAR');
  });
});
