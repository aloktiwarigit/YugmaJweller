/**
 * Story 17.1 Task 8 — Integration: upload → list (shopkeeper) + public catalog shape.
 *
 * Approach: Instantiate ProductImagesService and CatalogService directly (no NestJS
 * bootstrap, no Firebase emulator). Uses the same pattern as billing.integration.test.ts
 * and inventory-valuation.integration.test.ts.
 *
 * Tests:
 *   1. upload() returns ImageRow with storage_key, scan_status='clean', thumbnail_url.
 *   2. listForProduct() after upload returns length 1 (the inserted image).
 *   3. CatalogService.listPublicImages() (with mocked pool) returns PublicImageRow[]
 *      WITHOUT storage_key, WITH srcset/default_url/placeholder_url.
 *   4. srcset contains 'mb-0.25' and '1920w' (NFR-IMG-1: byte-cap + responsive widths).
 *   5. PublicImageRow does NOT have storage_key (security guard).
 *
 * Note: CatalogService.listPublicImages filters by `p.published_at IS NOT NULL`
 * (set by inventory.publishProduct). The public catalog DTO shape tests use a
 * mocked pool to assert the toPublicImageRow() mapping in isolation; full DB-
 * coupled coverage of listPublicImages lives in
 * product-images.public-catalog.spec.ts (Task 7 unit tests).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
import {
  StubStorageAdapter,
  StubMalwareScanAdapter,
  ImageKitTransformUrlBuilder,
} from '@goldsmith/integrations-storage';
import { ProductImagesRepository } from '../src/modules/inventory/product-images.repository';
import { ProductImagesService } from '../src/modules/inventory/product-images.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { SettingsRepository } from '../src/modules/settings/settings.repository';

// ---------------------------------------------------------------------------
// Fixture UUIDs — non-overlapping with other test files
// ---------------------------------------------------------------------------

const SHOP_A = 'aa400001-aa00-4000-aa00-000000000001';
const STORAGE_KEY_FOR_CATALOG = 'tenant/shop-a/products/prod-1/catalog-img.jpg';

const tenantAFull: Tenant = { id: SHOP_A, slug: 'int-shop-a', display_name: 'Int Shop A', status: 'ACTIVE' };

const ctxA: AuthenticatedTenantContext = {
  shopId: SHOP_A,
  tenant: tenantAFull,
  authenticated: true,
  userId: SHOP_A,
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
let catalogSvcWithMockPool: CatalogService;
let productId: string;

/** Generate a minimal valid JPEG using sharp (Task 4 pattern). */
async function fakeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 120, b: 60 } },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed shop
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'int-shop-a', 'Int Shop A', 'ACTIVE')`,
      [SHOP_A],
    );
  } finally {
    c.release();
  }

  // Seed shop_user for SHOP_A (FK for uploaded_by_user_id)
  await tenantContext.runWith(ctxAUnauth, () =>
    withTenantTx(pool, async (tx) => {
      await tx.query(
        `INSERT INTO shop_users (id, shop_id, phone, display_name, role, status)
           VALUES ($1, $2, '+919000004001', 'Owner A', 'shop_admin', 'ACTIVE')`,
        [SHOP_A, SHOP_A],
      );
    }),
  );

  // Seed a product in SHOP_A (status=IN_STOCK — valid per products_status_check)
  const pRes = await tenantContext.runWith(ctxAUnauth, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g,
            status, created_by_user_id)
         VALUES ($1, 'INT-A-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000',
                 'IN_STOCK', $2)
         RETURNING id`,
        [SHOP_A, SHOP_A],
      );
      return r.rows[0]!.id;
    }),
  );
  productId = pRes;

  // Build services directly (no NestJS DI)
  const urlBuilder = new ImageKitTransformUrlBuilder();
  const repo = new ProductImagesRepository(pool as never);

  svc = new ProductImagesService(
    repo,
    new StubStorageAdapter(),
    new StubMalwareScanAdapter(),
    pool as never,
    urlBuilder,
  );

  // CatalogService with mocked pool for public catalog DTO tests.
  // listPublicImages filters by p.published_at IS NOT NULL. Mocking the pool
  // here keeps the test focused on the toPublicImageRow() mapping shape without
  // needing to seed a real published product + image row.
  const mockPool = {
    query: vi.fn().mockResolvedValue({
      rows: [{
        id: 'img-catalog-001',
        alt_text: 'Gold ring',
        width: 800,
        height: 600,
        storage_key: STORAGE_KEY_FOR_CATALOG,
      }],
    }),
  };

  const settingsRepo = new SettingsRepository(pool as never);
  catalogSvcWithMockPool = new CatalogService(
    mockPool as never,
    {} as never, // pricingService — not used by listPublicImages
    settingsRepo,
    urlBuilder,
  );
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ---------------------------------------------------------------------------
// Tests: shopkeeper upload → list
// ---------------------------------------------------------------------------

describe('Image upload → list (shopkeeper endpoint)', () => {
  let uploadedId: string;

  it('upload() returns ImageRow with storage_key, scan_status=clean, thumbnail_url', async () => {
    const jpegBuf = await fakeJpeg(800, 600);

    const row = await tenantContext.runWith(ctxA, () =>
      svc.upload({
        productId,
        file: { buffer: jpegBuf, mimeType: 'image/jpeg', size: jpegBuf.byteLength },
        altText: 'Gold ring',
        idempotencyKey: 'int-test-idem-key-1',
      }),
    );

    expect(row).toHaveProperty('storage_key');
    expect(row.storage_key).toMatch(/^tenant\//);
    expect(row).toHaveProperty('scan_status', 'clean');
    expect(row).toHaveProperty('thumbnail_url');
    expect(row.thumbnail_url).toContain('w-200');
    expect(row.thumbnail_url).toContain('mb-0.25');
    expect(row).toHaveProperty('alt_text', 'Gold ring');
    expect(row.shop_id).toBe(SHOP_A);
    expect(row.product_id).toBe(productId);

    uploadedId = row.id;
  });

  it('listForProduct() after upload returns length=1 with thumbnail_url', async () => {
    const rows = await tenantContext.runWith(ctxA, () =>
      svc.listForProduct(productId),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(uploadedId);
    // F6-server (Codex P2 Task 7): thumbnail_url is server-built, not left to mobile.
    expect(rows[0]).toHaveProperty('thumbnail_url');
    expect(rows[0]!.thumbnail_url).toContain('mb-0.25');
  });
});

// ---------------------------------------------------------------------------
// Tests: public catalog DTO shape (CatalogService.listPublicImages)
// Covers Task 7 deviation: PublicImageRow must have srcset/default_url/placeholder_url
// and must NOT have storage_key.
// ---------------------------------------------------------------------------

describe('Public catalog images (CatalogService.listPublicImages)', () => {
  it('returns PublicImageRow[] with srcset/default_url/placeholder_url', async () => {
    const images = await catalogSvcWithMockPool.listPublicImages('prod-1', SHOP_A);
    expect(images).toHaveLength(1);

    const img = images[0]!;
    expect(img).toHaveProperty('id', 'img-catalog-001');
    expect(img).toHaveProperty('srcset');
    expect(img).toHaveProperty('default_url');
    expect(img).toHaveProperty('placeholder_url');
  });

  it('PublicImageRow does NOT have storage_key', async () => {
    const images = await catalogSvcWithMockPool.listPublicImages('prod-1', SHOP_A);
    expect(images[0]).not.toHaveProperty('storage_key');
  });

  it('srcset contains mb-0.25 and 1920w', async () => {
    const images = await catalogSvcWithMockPool.listPublicImages('prod-1', SHOP_A);
    expect(images[0]!.srcset).toContain('mb-0.25');
    expect(images[0]!.srcset).toContain('1920w');
  });

  it('default_url contains mb-0.25', async () => {
    const images = await catalogSvcWithMockPool.listPublicImages('prod-1', SHOP_A);
    expect(images[0]!.default_url).toContain('mb-0.25');
  });

  it('placeholder_url contains mb-0.25 and bl-30 (blur LQIP)', async () => {
    const images = await catalogSvcWithMockPool.listPublicImages('prod-1', SHOP_A);
    expect(images[0]!.placeholder_url).toContain('mb-0.25');
    expect(images[0]!.placeholder_url).toContain('bl-30');
  });
});
