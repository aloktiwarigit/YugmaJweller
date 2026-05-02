/**
 * Story 17.1 Task 8 — Cap-race: concurrent uploads on a product at count=9
 * → exactly one 201, one 409 ConflictException; final count=10.
 *
 * Approach: Instantiate ProductImagesService directly (same as billing.integration.test.ts).
 * Run two parallel upload() calls on the same product (pre-seeded with 9 images).
 * The FOR UPDATE pessimistic lock + 10-cap check must ensure exactly one upload succeeds
 * (ConflictException code 'IMAGE_LIMIT_REACHED' for the loser).
 *
 * Two uploads use DIFFERENT idempotency keys so each is a genuine new upload attempt,
 * not an idempotency replay (per task brief §concurrency test).
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
import { ConflictException } from '@nestjs/common';
import { ProductImagesRepository } from '../src/modules/inventory/product-images.repository';
import { ProductImagesService } from '../src/modules/inventory/product-images.service';

// ---------------------------------------------------------------------------
// Fixture UUIDs — non-overlapping with other test files
// ---------------------------------------------------------------------------

const SHOP_A = 'aa300001-aa00-4000-aa00-000000000001';

const tenantAFull: Tenant = { id: SHOP_A, slug: 'cap-shop-a', display_name: 'Cap Shop A', status: 'ACTIVE' };

const ctxA: AuthenticatedTenantContext = {
  shopId: SHOP_A,
  tenant: tenantAFull,
  authenticated: true,
  userId: SHOP_A, // shop UUID as placeholder user id
  role: 'shop_admin',
};

const ctxAUnauth: UnauthenticatedTenantContext = {
  shopId: SHOP_A,
  tenant: tenantAFull,
  authenticated: false,
};

// ---------------------------------------------------------------------------
// Shared infrastructure
// ---------------------------------------------------------------------------

let container: StartedPostgreSqlContainer;
let pool: Pool;
let svc: ProductImagesService;
let productId: string;

/** Generate a minimal valid JPEG using sharp (Task 4 pattern). */
async function fakeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 150, g: 200, b: 100 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/** Insert an image row directly (bypassing the service) to pre-fill up to N-1 images. */
async function insertImageDirect(shopId: string, prodId: string, userId: string, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await tenantContext.runWith(ctxAUnauth, () =>
      withTenantTx(pool, async (tx) => {
        await tx.query(
          `INSERT INTO product_images
             (shop_id, product_id, storage_key, mime_type, byte_size, width, height,
              exif_stripped_at, uploaded_by_user_id, scan_status, sort_order, idempotency_key)
           VALUES
             ($1, $2, $3, 'image/jpeg', 5000, 400, 300, NOW(), $4, 'clean', $5, NULL)`,
          [
            shopId,
            prodId,
            `tenant/${shopId}/products/${prodId}/prefill-${i}.jpg`,
            userId,
            i,
          ],
        );
      }),
    );
  }
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed shop
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'cap-shop-a', 'Cap Shop A', 'ACTIVE')`,
      [SHOP_A],
    );
  } finally {
    c.release();
  }

  // Seed user for SHOP_A (FK for uploaded_by_user_id when using service)
  await tenantContext.runWith(ctxAUnauth, () =>
    withTenantTx(pool, async (tx) => {
      await tx.query(
        `INSERT INTO shop_users (id, shop_id, phone, display_name, role, status)
           VALUES ($1, $2, '+919000003001', 'Owner A', 'shop_admin', 'ACTIVE')`,
        [SHOP_A, SHOP_A],
      );
    }),
  );

  // Seed product in SHOP_A
  const pRes = await tenantContext.runWith(ctxAUnauth, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'CAP-A-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000', 'IN_STOCK', $2)
         RETURNING id`,
        [SHOP_A, SHOP_A],
      );
      return r.rows[0]!.id;
    }),
  );
  productId = pRes;

  // Pre-fill 9 images directly (1 slot remaining before 10-cap)
  await insertImageDirect(SHOP_A, productId, SHOP_A, 9);

  // Build service with stubs
  const repo = new ProductImagesRepository(pool as never);
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

describe('ProductImages — cap-race under concurrent uploads', () => {
  it('two concurrent uploads with count=9 → [201, 409] and final count=10', async () => {
    const jpegBuf = await fakeJpeg(600, 400);

    // Two uploads with DIFFERENT idempotency keys — each is a genuine new attempt.
    const upload = (idem: string) =>
      tenantContext.runWith(ctxA, () =>
        svc.upload({
          productId,
          file: { buffer: jpegBuf, mimeType: 'image/jpeg', size: jpegBuf.byteLength },
          altText: null,
          idempotencyKey: idem,
        }),
      );

    const [r1, r2] = await Promise.allSettled([
      upload('cap-race-key-1'),
      upload('cap-race-key-2'),
    ]);

    const statuses = [r1.status, r2.status].sort();
    // Exactly one must succeed (fulfilled) and one must reject with ConflictException.
    expect(statuses).toEqual(['fulfilled', 'rejected']);

    const rejected = [r1, r2].find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
    expect((rejected.reason as ConflictException).getResponse()).toMatchObject({
      code: 'IMAGE_LIMIT_REACHED',
    });

    // Final DB count must be exactly 10 (cap held)
    const c = await pool.connect();
    try {
      const countRes = await c.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM product_images WHERE product_id = $1`,
        [productId],
      );
      expect(parseInt(countRes.rows[0]!.count, 10)).toBe(10);
    } finally {
      c.release();
    }
  });
});
