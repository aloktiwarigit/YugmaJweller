import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

const SHOP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SHOP_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let productAId: string;
let productBId: string;
let imageAId: string;  // owned by SHOP_A
let imageBId: string;  // owned by SHOP_B

const ctxFor = (shopId: string): UnauthenticatedTenantContext => {
  const tenant: Tenant = { id: shopId, slug: `shop-${shopId.slice(0, 4)}`, display_name: 'Shop', status: 'ACTIVE' };
  return { shopId, tenant, authenticated: false };
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
  } finally { c.release(); }

  const seedUser = async (shopId: string, phone: string) =>
    tenantContext.runWith(ctxFor(shopId), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
           VALUES ($1, $2, 'Owner', 'shop_admin', 'ACTIVE') RETURNING id`,
          [shopId, phone],
        );
        return r.rows[0]!.id;
      }),
    );

  const seedProduct = async (shopId: string, sku: string) =>
    tenantContext.runWith(ctxFor(shopId), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO products
             (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
           VALUES ($1, $2, 'GOLD', '22K', '10.0000', '9.0000', '0.0000', 'IN_STOCK', $1) RETURNING id`,
          [shopId, sku],
        );
        return r.rows[0]!.id;
      }),
    );

  const seedImage = async (shopId: string, productId: string, userId: string) =>
    tenantContext.runWith(ctxFor(shopId), () =>
      withTenantTx(pool, async (tx) => {
        const r = await tx.query<{ id: string }>(
          `INSERT INTO product_images
             (shop_id, product_id, storage_key, mime_type, byte_size, width, height,
              exif_stripped_at, uploaded_by_user_id, scan_status, sort_order)
           VALUES ($1, $2, $3, 'image/jpeg', 1024, 800, 600, NOW(), $4, 'clean', 0) RETURNING id`,
          [shopId, productId, `tenant/${shopId}/hero/${Math.random().toString(36).slice(2)}.jpg`, userId],
        );
        return r.rows[0]!.id;
      }),
    );

  const userAId = await seedUser(SHOP_A, '+919000000001');
  const userBId = await seedUser(SHOP_B, '+919000000002');
  productAId  = await seedProduct(SHOP_A, 'RING-A-001');
  productBId  = await seedProduct(SHOP_B, 'RING-B-001');
  imageAId    = await seedImage(SHOP_A, productAId, userAId);
  imageBId    = await seedImage(SHOP_B, productBId, userBId);
}, 180_000);

afterAll(async () => { await pool?.end(); await container?.stop(); });

const insertCollection = (shopId: string, slug: string, heroImageId?: string | null) =>
  tenantContext.runWith(ctxFor(shopId), () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO collections (shop_id, slug, title_hi, hero_image_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [shopId, slug, 'कलेक्शन', heroImageId ?? null],
      );
      return r.rows[0]!.id;
    }),
  );

describe('migration 0067: collections + collection_products RLS + composite FK', () => {

  describe('WS-C: tenant-isolation via composite FK', () => {
    it('rejects hero_image_id belonging to a different shop — composite FK 23503', async () => {
      await expect(
        insertCollection(SHOP_A, 'hero-xshop-test', imageBId),
      ).rejects.toMatchObject({ code: '23503' });
    });

    it('accepts hero_image_id belonging to the same shop — composite FK satisfied', async () => {
      const id = await insertCollection(SHOP_A, 'hero-same-shop', imageAId);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('rejects cross-tenant product in collection_products — composite FK 23503', async () => {
      const colId = await insertCollection(SHOP_A, 'cp-xshop-test');
      await expect(
        tenantContext.runWith(ctxFor(SHOP_A), () =>
          withTenantTx(pool, (tx) =>
            tx.query(
              `INSERT INTO collection_products (shop_id, collection_id, product_id) VALUES ($1, $2, $3)`,
              [SHOP_A, colId, productBId],
            ),
          ),
        ),
      ).rejects.toMatchObject({ code: '23503' });
    });

    it('RLS blocks cross-tenant SELECT on collections', async () => {
      await insertCollection(SHOP_A, 'rls-vis-a');
      await insertCollection(SHOP_B, 'rls-vis-b');

      const rowsA = await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, async (tx) => {
          const r = await tx.query<{ shop_id: string }>(`SELECT shop_id FROM collections`);
          return r.rows;
        }),
      );
      expect(rowsA.every((r) => r.shop_id === SHOP_A)).toBe(true);

      const rowsB = await tenantContext.runWith(ctxFor(SHOP_B), () =>
        withTenantTx(pool, async (tx) => {
          const r = await tx.query<{ shop_id: string }>(`SELECT shop_id FROM collections`);
          return r.rows;
        }),
      );
      expect(rowsB.every((r) => r.shop_id === SHOP_B)).toBe(true);
    });
  });

  describe('WS-D: cascade behavior', () => {
    it('deleting a collection cascades join rows; products untouched', async () => {
      const colId = await insertCollection(SHOP_A, 'cascade-col');
      await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, (tx) =>
          tx.query(
            `INSERT INTO collection_products (shop_id, collection_id, product_id) VALUES ($1, $2, $3)`,
            [SHOP_A, colId, productAId],
          ),
        ),
      );
      await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, (tx) => tx.query(`DELETE FROM collections WHERE id = $1`, [colId])),
      );

      // Use raw superuser pool to verify without RLS interference.
      const c = await pool.connect();
      try {
        const jp = await c.query<{ count: string }>(
          `SELECT count(*)::int AS count FROM collection_products WHERE collection_id = $1`,
          [colId],
        );
        expect(Number(jp.rows[0]!.count)).toBe(0);

        const pr = await c.query<{ count: string }>(
          `SELECT count(*)::int AS count FROM products WHERE id = $1`,
          [productAId],
        );
        expect(Number(pr.rows[0]!.count)).toBe(1);
      } finally { c.release(); }
    });

    it('deleting a product cascades join rows; collection untouched', async () => {
      const tmpProdId = await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, async (tx) => {
          const r = await tx.query<{ id: string }>(
            `INSERT INTO products
               (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
             VALUES ($1, 'TMP-CASCADE-PROD', 'GOLD', '22K', '5.0000', '4.5000', '0.0000', 'IN_STOCK', $1)
             RETURNING id`,
            [SHOP_A],
          );
          return r.rows[0]!.id;
        }),
      );
      const tmpColId = await insertCollection(SHOP_A, 'cascade-prod');
      await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, (tx) =>
          tx.query(
            `INSERT INTO collection_products (shop_id, collection_id, product_id) VALUES ($1, $2, $3)`,
            [SHOP_A, tmpColId, tmpProdId],
          ),
        ),
      );
      await tenantContext.runWith(ctxFor(SHOP_A), () =>
        withTenantTx(pool, (tx) => tx.query(`DELETE FROM products WHERE id = $1`, [tmpProdId])),
      );

      const c = await pool.connect();
      try {
        const jr = await c.query<{ count: string }>(
          `SELECT count(*)::int AS count FROM collection_products WHERE product_id = $1`,
          [tmpProdId],
        );
        expect(Number(jr.rows[0]!.count)).toBe(0);

        const cr = await c.query<{ count: string }>(
          `SELECT count(*)::int AS count FROM collections WHERE id = $1`,
          [tmpColId],
        );
        expect(Number(cr.rows[0]!.count)).toBe(1);
      } finally { c.release(); }
    });
  });

  describe('WS-E: constraint enforcement', () => {
    it('unique (shop_id, slug): duplicate in same shop → 23505', async () => {
      await insertCollection(SHOP_A, 'dup-slug');
      await expect(insertCollection(SHOP_A, 'dup-slug')).rejects.toMatchObject({ code: '23505' });
    });

    it('unique (shop_id, slug): same slug in different shops → allowed', async () => {
      await insertCollection(SHOP_A, 'cross-shop-slug');
      const id = await insertCollection(SHOP_B, 'cross-shop-slug');
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('DB CHECK rejects invalid slug formats → 23514', async () => {
      for (const bad of ['bridal_2026', 'Bridal-2026', 'bridal-', '-bridal', 'bridal--edit', '']) {
        await expect(insertCollection(SHOP_A, bad)).rejects.toMatchObject({ code: '23514' });
      }
    });

    it('valid slug formats pass CHECK', async () => {
      const id1 = await insertCollection(SHOP_A, 'bridal-2026');
      expect(id1).toMatch(/^[0-9a-f-]{36}$/);
      const id2 = await insertCollection(SHOP_A, 'new');
      expect(id2).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
