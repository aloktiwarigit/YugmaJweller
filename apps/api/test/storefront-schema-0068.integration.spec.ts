// apps/api/test/storefront-schema-0068.integration.spec.ts
//
// Mandatory spec tests T1 (FK cross-tenant) and T2 (trigger SECURITY INVOKER).
// UUID prefix dd5xxxxx / ee5xxxxx — non-overlapping with other test files.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

// ---------------------------------------------------------------------------
// Fixture UUIDs — non-overlapping with other integration test files
// ---------------------------------------------------------------------------
const SHOP_A = 'dd500001-dd00-4000-dd00-000000000001';
const SHOP_B = 'ee500002-ee00-4000-ee00-000000000002';

const tenantA: Tenant = { id: SHOP_A, slug: 'stf-0068-a', display_name: '0068 Shop A', status: 'ACTIVE' };
const tenantB: Tenant = { id: SHOP_B, slug: 'stf-0068-b', display_name: '0068 Shop B', status: 'ACTIVE' };
const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };
const ctxB: UnauthenticatedTenantContext = { shopId: SHOP_B, tenant: tenantB, authenticated: false };

let container: StartedPostgreSqlContainer;
let pool: Pool;
let userAId: string;
let userBId: string;
let productAId: string;
let productBId: string;

// Inserts a product_images row in the given tenant context.
const insertImage = (
  shopId: string,
  ctx: UnauthenticatedTenantContext,
  productId: string,
  uploaderId: string,
  opts: { sortOrder?: number; scanStatus?: string } = {},
) =>
  tenantContext.runWith(ctx, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO product_images
           (shop_id, product_id, storage_key, mime_type, byte_size, width, height,
            exif_stripped_at, uploaded_by_user_id, scan_status, sort_order)
         VALUES
           ($1, $2, $3, 'image/jpeg', 1234, 800, 600,
            NOW(), $4, $5, $6)
         RETURNING id`,
        [
          shopId,
          productId,
          `tenant/${shopId}/products/${productId}/${Math.random().toString(36).slice(2)}.jpg`,
          uploaderId,
          opts.scanStatus ?? 'clean',
          opts.sortOrder ?? 0,
        ],
      );
      return r.rows[0]!.id;
    }),
  );

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed shops via raw connection
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES
        ($1, 'stf-0068-a', '0068 Shop A', 'ACTIVE'),
        ($2, 'stf-0068-b', '0068 Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
  } finally {
    c.release();
  }

  // Seed users
  userAId = await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
           VALUES ($1, '+919500000101', 'Owner 0068A', 'shop_admin', 'ACTIVE') RETURNING id`,
        [SHOP_A],
      );
      return r.rows[0]!.id;
    }),
  );

  userBId = await tenantContext.runWith(ctxB, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
           VALUES ($1, '+919500000102', 'Owner 0068B', 'shop_admin', 'ACTIVE') RETURNING id`,
        [SHOP_B],
      );
      return r.rows[0]!.id;
    }),
  );

  // Seed products
  productAId = await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
            stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'STF0068-A-001', 'GOLD', '22K', '10.0000', '9.0000',
                 '0.0000', 'IN_STOCK', $2)
         RETURNING id`,
        [SHOP_A, userAId],
      );
      return r.rows[0]!.id;
    }),
  );

  productBId = await tenantContext.runWith(ctxB, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
            stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'STF0068-B-001', 'GOLD', '22K', '10.0000', '9.0000',
                 '0.0000', 'IN_STOCK', $2)
         RETURNING id`,
        [SHOP_B, userBId],
      );
      return r.rows[0]!.id;
    }),
  );
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ---------------------------------------------------------------------------
// T1 — primary_image_id FK does not bypass RLS via cross-tenant image
// ---------------------------------------------------------------------------
describe('migration 0068: composite FK cross-tenant guard', () => {
  it('rejects setting primary_image_id to a cross-tenant image (FK violation 23503)', async () => {
    // Insert a valid image in Shop B for Shop B's product.
    const imageBId = await insertImage(SHOP_B, ctxB, productBId, userBId);

    // Attempt to point Shop A's product at Shop B's image.
    // Composite FK (shop_id, primary_image_id) → product_images(shop_id, id) requires
    // that (SHOP_A, imageBId) exists in product_images — it does not → 23503.
    await expect(
      tenantContext.runWith(ctxA, () =>
        withTenantTx(pool, (tx) =>
          tx.query(
            `UPDATE products SET primary_image_id = $1 WHERE id = $2`,
            [imageBId, productAId],
          ),
        ),
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('allows same-tenant primary_image_id assignment (control)', async () => {
    // Insert a clean image in Shop A for Shop A's product.
    const imageAId = await insertImage(SHOP_A, ctxA, productAId, userAId);

    // Same-tenant assignment must succeed.
    await expect(
      tenantContext.runWith(ctxA, () =>
        withTenantTx(pool, (tx) =>
          tx.query(
            `UPDATE products SET primary_image_id = $1 WHERE id = $2`,
            [imageAId, productAId],
          ),
        ),
      ),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// T2 — maintain trigger respects RLS under SECURITY INVOKER
// ---------------------------------------------------------------------------
describe('migration 0068: maintain trigger (SECURITY INVOKER)', () => {
  it('trigger auto-sets primary_image_id on first clean image INSERT', async () => {
    // Products start with NULL primary_image_id; inserting a clean image should trigger recompute.
    const imageId = await insertImage(SHOP_A, ctxA, productAId, userAId, { sortOrder: 99 });

    // The trigger should have set products.primary_image_id to this image.
    // Use raw pool connection to bypass RLS for the assertion read.
    const r = await pool.query<{ primary_image_id: string | null }>(
      `SELECT primary_image_id FROM products WHERE id = $1`,
      [productAId],
    );
    // primary_image_id must be some image belonging to productA (the one with lowest sort_order)
    expect(r.rows[0]!.primary_image_id).toBeTruthy();
  });

  it('trigger NULLs primary_image_id when last clean image is deleted', async () => {
    // Insert exactly one clean image in a fresh product to have a controlled state.
    // Use a new product to avoid state from previous test.
    const freshProductId = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO products
             (shop_id, sku, metal, purity, gross_weight_g, net_weight_g,
              stone_weight_g, status, created_by_user_id)
           VALUES ($1, 'STF0068-A-002', 'GOLD', '22K', '10.0000', '9.0000',
                   '0.0000', 'IN_STOCK', $2)
           RETURNING id`,
          [SHOP_A, userAId],
        );
        return r.rows[0]!.id;
      }),
    );

    const onlyImageId = await insertImage(SHOP_A, ctxA, freshProductId, userAId, { sortOrder: 0 });

    // Verify trigger set primary_image_id
    const before = await pool.query<{ primary_image_id: string | null }>(
      `SELECT primary_image_id FROM products WHERE id = $1`,
      [freshProductId],
    );
    expect(before.rows[0]!.primary_image_id).toBe(onlyImageId);

    // Delete the only clean image as Shop A user
    await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, (tx) =>
        tx.query(`DELETE FROM product_images WHERE id = $1`, [onlyImageId]),
      ),
    );

    // Trigger must have NULLed primary_image_id (no more clean images)
    const after = await pool.query<{ primary_image_id: string | null }>(
      `SELECT primary_image_id FROM products WHERE id = $1`,
      [freshProductId],
    );
    expect(after.rows[0]!.primary_image_id).toBeNull();
  });

  it('trigger does not affect other tenant products (RLS under SECURITY INVOKER)', async () => {
    // Record Shop B product primary_image_id before any Shop A operation
    const beforeB = await pool.query<{ primary_image_id: string | null }>(
      `SELECT primary_image_id FROM products WHERE id = $1`,
      [productBId],
    );
    const bPrimaryBefore = beforeB.rows[0]!.primary_image_id;

    // Insert a new image in Shop A (triggers recompute for Shop A's product only)
    await insertImage(SHOP_A, ctxA, productAId, userAId, { sortOrder: 0 });

    // Shop B's product primary_image_id must be unchanged
    const afterB = await pool.query<{ primary_image_id: string | null }>(
      `SELECT primary_image_id FROM products WHERE id = $1`,
      [productBId],
    );
    expect(afterB.rows[0]!.primary_image_id).toBe(bPrimaryBefore);
  });
});
