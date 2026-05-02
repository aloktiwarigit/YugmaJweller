/**
 * Story 17.1 Task 8 — RLS: direct SQL with Tenant-A GUC cannot SELECT Tenant-B images.
 *
 * Approach: Same as rls-fail-loud.integration.test.ts and inventory-isolation.integration.test.ts.
 * Insert images directly using withTenantTx (bypasses RLS via app_user role + GUC).
 * Then query as Tenant-A and verify 0 rows returned for Tenant-B's images.
 *
 * Uses `pi.shop_id = $1` filter as instructed in task brief to ensure the check
 * works without GUC OR with the wrong-tenant GUC.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import {
  tenantContext,
  type Tenant,
  type UnauthenticatedTenantContext,
} from '@goldsmith/tenant-context';

// ---------------------------------------------------------------------------
// Fixture UUIDs — non-overlapping with other test files
// ---------------------------------------------------------------------------

const SHOP_A = 'aa200001-aa00-4000-aa00-000000000001';
const SHOP_B = 'bb200002-bb00-4000-bb00-000000000002';

const tenantAFull: Tenant = { id: SHOP_A, slug: 'rls-shop-a', display_name: 'RLS Shop A', status: 'ACTIVE' };
const tenantBFull: Tenant = { id: SHOP_B, slug: 'rls-shop-b', display_name: 'RLS Shop B', status: 'ACTIVE' };

const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantAFull, authenticated: false };
const ctxB: UnauthenticatedTenantContext = { shopId: SHOP_B, tenant: tenantBFull, authenticated: false };

// ---------------------------------------------------------------------------
// Shared infrastructure
// ---------------------------------------------------------------------------

let container: StartedPostgreSqlContainer;
let pool: Pool;
let productBId: string;
let userBId: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed shops
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES
        ($1, 'rls-shop-a', 'RLS Shop A', 'ACTIVE'),
        ($2, 'rls-shop-b', 'RLS Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
  } finally {
    c.release();
  }

  // Seed shop_users for SHOP_B (uploaded_by_user_id FK target)
  const uRes = await tenantContext.runWith(ctxB, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
           VALUES ($1, '+919000002002', 'Owner B', 'shop_admin', 'ACTIVE')
           RETURNING id`,
        [SHOP_B],
      );
      return r.rows[0]!.id;
    }),
  );
  userBId = uRes;

  // Seed a product in SHOP_B
  const pRes = await tenantContext.runWith(ctxB, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'RLS-B-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000', 'IN_STOCK', $2)
         RETURNING id`,
        [SHOP_B, userBId],
      );
      return r.rows[0]!.id;
    }),
  );
  productBId = pRes;

  // Insert an image row for Tenant-B's product via Tenant-B context (valid insert)
  await tenantContext.runWith(ctxB, () =>
    withTenantTx(pool, async (tx) => {
      await tx.query(
        `INSERT INTO product_images
           (shop_id, product_id, storage_key, mime_type, byte_size, width, height,
            exif_stripped_at, uploaded_by_user_id, scan_status, sort_order, idempotency_key)
         VALUES
           ($1, $2, $3, 'image/jpeg', 12345, 800, 600, NOW(), $4, 'clean', 0, NULL)`,
        [
          SHOP_B,
          productBId,
          `tenant/${SHOP_B}/products/${productBId}/rls-test-img.jpg`,
          userBId,
        ],
      );
    }),
  );
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('product_images RLS', () => {
  it('Tenant-A withTenantTx SELECT sees 0 rows for Tenant-B images', async () => {
    // withTenantTx sets SET LOCAL app.current_shop_id = SHOP_A before the query.
    // RLS policy on product_images filters WHERE shop_id = current_setting('app.current_shop_id').
    // Tenant-A's GUC must not match Tenant-B's shop_id, so 0 rows returned.
    const rows = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `SELECT id FROM product_images WHERE shop_id = $1`,
          [SHOP_B],
        );
        return r.rows;
      }),
    );
    expect(rows).toHaveLength(0);
  });

  it('Tenant-A withTenantTx SELECT * FROM product_images sees 0 rows (RLS hides all B rows)', async () => {
    // Without any shop_id filter, RLS should still hide Tenant-B's rows when
    // the GUC is set to SHOP_A.
    const rows = await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `SELECT id FROM product_images`,
        );
        return r.rows;
      }),
    );
    expect(rows).toHaveLength(0);
  });

  it('Tenant-B withTenantTx SELECT sees its own 1 image row', async () => {
    // Control: Tenant-B can see its own row (RLS allows matching shop_id).
    const rows = await tenantContext.runWith(ctxB, () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `SELECT id FROM product_images WHERE shop_id = $1`,
          [SHOP_B],
        );
        return r.rows;
      }),
    );
    expect(rows).toHaveLength(1);
  });
});
