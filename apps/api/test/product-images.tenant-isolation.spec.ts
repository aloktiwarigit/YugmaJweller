/**
 * Story 17.1 Task 8 — Tenant isolation: Tenant-A cannot upload to Tenant-B's product.
 *
 * Approach: Instantiate ProductImagesService directly (same pattern as
 * billing.integration.test.ts / inventory-valuation.integration.test.ts).
 * No NestJS bootstrap; no Firebase emulator. TenantContext is injected via
 * tenantContext.runWith().
 *
 * Assertion:
 *   - Calling upload() as Tenant-A with a product owned by Tenant-B → NotFoundException
 *     (the FOR UPDATE lock in lockProductForTenant returns null → 404, NOT a FK 23503).
 *   - Zero product_images rows exist for Tenant-B's product after the attempt.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import {
  tenantContext,
  type Tenant,
  type AuthenticatedTenantContext,
  type UnauthenticatedTenantContext,
} from '@goldsmith/tenant-context';
import { StubStorageAdapter } from '@goldsmith/integrations-storage';
import { StubMalwareScanAdapter } from '@goldsmith/integrations-storage';
import { ImageKitTransformUrlBuilder } from '@goldsmith/integrations-storage';
import { NotFoundException } from '@nestjs/common';
import { ProductImagesRepository } from '../src/modules/inventory/product-images.repository';
import { ProductImagesService } from '../src/modules/inventory/product-images.service';

// ---------------------------------------------------------------------------
// Fixture UUIDs — non-overlapping with other test files
// ---------------------------------------------------------------------------

const SHOP_A = 'aa100001-aa00-4000-aa00-000000000001';
const SHOP_B = 'bb100002-bb00-4000-bb00-000000000002';

const tenantAFull: Tenant = { id: SHOP_A, slug: 'ti-shop-a', display_name: 'TI Shop A', status: 'ACTIVE' };
const tenantBFull: Tenant = { id: SHOP_B, slug: 'ti-shop-b', display_name: 'TI Shop B', status: 'ACTIVE' };

const ctxA: AuthenticatedTenantContext = {
  shopId: SHOP_A,
  tenant: tenantAFull,
  authenticated: true,
  userId: SHOP_A, // use shop UUID as user UUID for seeding simplicity
  role: 'shop_admin',
};

const ctxBUnauth: UnauthenticatedTenantContext = {
  shopId: SHOP_B,
  tenant: tenantBFull,
  authenticated: false,
};

// ---------------------------------------------------------------------------
// Shared infrastructure
// ---------------------------------------------------------------------------

let container: StartedPostgreSqlContainer;
let pool: Pool;
let svc: ProductImagesService;
let productBId: string;

/** Generate a minimal valid JPEG using sharp (Task 4 pattern). */
async function fakeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed shops
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES
        ($1, 'ti-shop-a', 'TI Shop A', 'ACTIVE'),
        ($2, 'ti-shop-b', 'TI Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
  } finally {
    c.release();
  }

  // Seed a shop_admin user for SHOP_A (FK for uploaded_by_user_id)
  await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      await tx.query(
        `INSERT INTO shop_users (id, shop_id, phone, display_name, role, status)
           VALUES ($1, $2, '+919000001001', 'Owner A', 'shop_admin', 'ACTIVE')`,
        [SHOP_A, SHOP_A],
      );
    }),
  );

  // Seed a shop_admin user for SHOP_B
  await tenantContext.runWith(ctxBUnauth, () =>
    withTenantTx(pool, async (tx) => {
      await tx.query(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
           VALUES ($1, '+919000001002', 'Owner B', 'shop_admin', 'ACTIVE')`,
        [SHOP_B],
      );
    }),
  );

  // Seed a product in SHOP_B
  const r = await tenantContext.runWith(ctxBUnauth, () =>
    withTenantTx(pool, async (tx) => {
      const res = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'TI-B-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000', 'IN_STOCK', $2)
         RETURNING id`,
        [SHOP_B, SHOP_B], // use shop UUID as placeholder user id for SHOP_B product
      );
      return res.rows[0]!.id;
    }),
  );
  productBId = r;

  // Build service with stubs (no NestJS container)
  const repo = new ProductImagesRepository(pool as never);
  (repo as unknown as { pool: Pool }).pool = pool;
  svc = new ProductImagesService(
    repo,
    new StubStorageAdapter(),
    new StubMalwareScanAdapter(),
    pool as never,
    new ImageKitTransformUrlBuilder(),
  );
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductImages — cross-tenant isolation', () => {
  it('Tenant-A upload to Tenant-B productId → NotFoundException (not FK 23503)', async () => {
    const jpegBuf = await fakeJpeg(800, 600);

    // Run upload as Tenant-A but targeting Tenant-B's product.
    await expect(
      tenantContext.runWith(ctxA, () =>
        svc.upload({
          productId: productBId,
          file: { buffer: jpegBuf, mimeType: 'image/jpeg', size: jpegBuf.byteLength },
          altText: null,
          idempotencyKey: null,
        }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('zero product_images rows inserted in Tenant-B product after cross-tenant attempt', async () => {
    // Use a raw connection (bypasses RLS) to verify no row was sneaked in.
    const c = await pool.connect();
    try {
      const r = await c.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM product_images WHERE product_id = $1 AND shop_id = $2`,
        [productBId, SHOP_B],
      );
      expect(parseInt(r.rows[0]!.count, 10)).toBe(0);
    } finally {
      c.release();
    }
  });
});
