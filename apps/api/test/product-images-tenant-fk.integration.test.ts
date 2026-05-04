import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

// Story 17.1 Codex round-1 follow-up — verifies migration 0058 closes the
// cross-tenant FK loophole left by 0057 and adds the (product_id,
// idempotency_key) partial UNIQUE index used for upload idempotency (F7).

const SHOP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SHOP_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let productAId: string;
let productAId2: string;
let productBId: string;
let userAId: string;
let userBId: string;

const ctxFor = (id: string, slug: string, name: string): UnauthenticatedTenantContext => {
  const tenant: Tenant = { id, slug, display_name: name, status: 'ACTIVE' };
  return { shopId: id, tenant, authenticated: false };
};

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES
        ($1, 'shop-a', 'Shop A', 'ACTIVE'),
        ($2, 'shop-b', 'Shop B', 'ACTIVE')`,
      [SHOP_A, SHOP_B],
    );
  } finally {
    c.release();
  }

  // Seed users in each shop (used for uploaded_by_user_id FK target).
  const seedUser = async (shopId: string, phone: string) =>
    tenantContext.runWith(ctxFor(shopId, `s-${shopId.slice(0, 4)}`, 'X'), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
             VALUES ($1, $2, 'Owner', 'shop_admin', 'ACTIVE') RETURNING id`,
          [shopId, phone],
        );
        return r.rows[0]!.id;
      }),
    );
  userAId = await seedUser(SHOP_A, '+919999999991');
  userBId = await seedUser(SHOP_B, '+919999999992');

  // Seed products in each shop. Shop A gets two so we can test same-tenant moves.
  const seedProduct = async (shopId: string, userId: string, sku: string) =>
    tenantContext.runWith(ctxFor(shopId, `s-${shopId.slice(0, 4)}`, 'X'), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO products
             (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
           VALUES ($1, $2, 'GOLD', '22K', '10.0000', '9.0000', '0.0000', 'IN_STOCK', $3)
           RETURNING id`,
          [shopId, sku, userId],
        );
        return r.rows[0]!.id;
      }),
    );
  productAId  = await seedProduct(SHOP_A, userAId, 'A-001');
  productAId2 = await seedProduct(SHOP_A, userAId, 'A-002');
  productBId  = await seedProduct(SHOP_B, userBId, 'B-001');
}, 180_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

const insertImage = (
  shopId: string,
  productId: string,
  uploaderId: string,
  opts: { idempotencyKey?: string | null; storageKey?: string } = {},
) => {
  const ctx = ctxFor(shopId, `s-${shopId.slice(0, 4)}`, 'X');
  return tenantContext.runWith(ctx, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO product_images
           (shop_id, product_id, storage_key, mime_type, byte_size, width, height,
            exif_stripped_at, uploaded_by_user_id, scan_status, sort_order, idempotency_key)
         VALUES
           ($1, $2, $3, 'image/jpeg', 1234, 800, 600,
            NOW(), $4, 'clean', 0, $5)
         RETURNING id`,
        [
          shopId,
          productId,
          opts.storageKey ?? `tenant/${shopId}/products/${productId}/${Math.random().toString(36).slice(2)}.jpg`,
          uploaderId,
          opts.idempotencyKey ?? null,
        ],
      );
      return r.rows[0]!.id;
    }),
  );
};

describe('migration 0058: composite tenant FK + idempotency UNIQUE', () => {
  it('rejects cross-tenant INSERT — product_id belongs to another shop', async () => {
    // Tenant A inserts product_images pointing at B's product; FK target lookup
    // is `(shop_id=A, product_id=B's-id)` against products(shop_id, id) — no match.
    await expect(insertImage(SHOP_A, productBId, userAId)).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects cross-tenant INSERT — uploaded_by_user_id belongs to another shop', async () => {
    await expect(insertImage(SHOP_A, productAId, userBId)).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects cross-tenant UPDATE of product_id', async () => {
    // Insert a valid same-tenant row first.
    const imgId = await insertImage(SHOP_A, productAId, userAId);
    const ctxA = ctxFor(SHOP_A, 's-aaaa', 'X');
    await expect(
      tenantContext.runWith(ctxA, () =>
        withTenantTx(pool, (tx) =>
          tx.query(
            `UPDATE product_images SET product_id = $1 WHERE id = $2`,
            [productBId, imgId],
          ),
        ),
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('allows same-tenant INSERT and UPDATE (control)', async () => {
    const imgId = await insertImage(SHOP_A, productAId, userAId);
    expect(imgId).toMatch(/[0-9a-f-]{36}/);
    // Same-tenant move from productA → productA2 must succeed.
    const ctxA = ctxFor(SHOP_A, 's-aaaa', 'X');
    await tenantContext.runWith(ctxA, () =>
      withTenantTx(pool, (tx) =>
        tx.query(`UPDATE product_images SET product_id = $1 WHERE id = $2`, [productAId2, imgId]),
      ),
    );
  });

  it('rejects duplicate idempotency_key on same product (F7 DB layer)', async () => {
    await insertImage(SHOP_A, productAId, userAId, { idempotencyKey: 'KEY-DUP-1' });
    await expect(
      insertImage(SHOP_A, productAId, userAId, { idempotencyKey: 'KEY-DUP-1' }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('allows same idempotency_key on different products (F7 scoping)', async () => {
    const id1 = await insertImage(SHOP_A, productAId,  userAId, { idempotencyKey: 'KEY-SCOPE-1' });
    const id2 = await insertImage(SHOP_A, productAId2, userAId, { idempotencyKey: 'KEY-SCOPE-1' });
    expect(id1).not.toBe(id2);
  });

  it('allows multiple NULL idempotency_keys on same product (partial index)', async () => {
    const id1 = await insertImage(SHOP_A, productAId, userAId, { idempotencyKey: null });
    const id2 = await insertImage(SHOP_A, productAId, userAId, { idempotencyKey: null });
    expect(id1).not.toBe(id2);
  });
});
