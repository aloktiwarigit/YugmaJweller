import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';
import { InventoryRepository } from '../src/modules/inventory/inventory.repository';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Tenant, UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

const SHOP_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const USER_ID = 'ffffffff-0000-0000-0000-000000000001';
const tenant: Tenant = { id: SHOP_ID, slug: 'smoke-test-shop', display_name: 'Smoke Shop', status: 'ACTIVE' };
const ctx: UnauthenticatedTenantContext = { shopId: SHOP_ID, tenant, authenticated: false };

describe('publish/unpublish — smoke test against real Postgres', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let repo: InventoryRepository;
  let productId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
    repo = new InventoryRepository(pool, { logInTx: () => Promise.resolve(1n) } as never);

    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, $2, $3, 'ACTIVE')`,
      [SHOP_ID, tenant.slug, tenant.display_name],
    );
    // Story 17.1 — product_images now has a NOT NULL FK to shop_users(id),
    // so we seed the user before inserting the image row.
    await pool.query(
      `INSERT INTO shop_users (id, shop_id, phone, display_name, role, status)
       VALUES ($1, $2, '+910000000000', 'Smoke User', 'shop_admin', 'ACTIVE')`,
      [USER_ID, SHOP_ID],
    );

    // Create a product
    const row = await tenantContext.runWith(ctx, () =>
      repo.createProduct({
        shopId: SHOP_ID,
        createdByUserId: USER_ID,
        sku: 'SMOKE-001',
        metal: 'GOLD',
        purity: '22K',
        grossWeightG: '10.0000',
        netWeightG: '9.0000',
        status: 'IN_STOCK',
      }),
    );
    productId = row.id;

    // Seed a product_images row directly — the legacy insertImageRecord
    // helper has been retired (Story 17.1 retires the upload-url path).
    // Direct DML is acceptable in test setup; production writes go through
    // ProductImagesService.upload.
    await pool.query(
      `INSERT INTO product_images (
         shop_id, product_id, storage_key, mime_type, byte_size,
         width, height, exif_stripped_at, uploaded_by_user_id
       ) VALUES ($1, $2, $3, 'image/jpeg', 12345, 800, 600, now(), $4)`,
      [SHOP_ID, productId, `tenant/${SHOP_ID}/products/${productId}/img1.jpg`, USER_ID],
    );
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('publish: sets published_at and published_by_user_id in DB', async () => {
    const row = await tenantContext.runWith(ctx, () =>
      repo.publishProduct(productId, USER_ID),
    );
    expect(row).not.toBeNull();
    expect(row!.published_at).toBeInstanceOf(Date);
    expect(row!.published_by_user_id).toBe(USER_ID);
  });

  it('publish is idempotent: re-sets published_at on second call', async () => {
    const first = await tenantContext.runWith(ctx, () => repo.publishProduct(productId, USER_ID));
    await new Promise((r) => setTimeout(r, 20));
    const second = await tenantContext.runWith(ctx, () => repo.publishProduct(productId, USER_ID));
    expect(second).not.toBeNull();
    expect(second!.published_at!.getTime()).toBeGreaterThanOrEqual(first!.published_at!.getTime());
  });

  it('unpublish: clears published_at and published_by_user_id in DB', async () => {
    const row = await tenantContext.runWith(ctx, () =>
      repo.unpublishProduct(productId),
    );
    expect(row).not.toBeNull();
    expect(row!.published_at).toBeNull();
    expect(row!.published_by_user_id).toBeNull();
  });

  it('countImages returns > 0 when a product_images row exists', async () => {
    const count = await tenantContext.runWith(ctx, () =>
      repo.countImages(productId),
    );
    expect(count).toBeGreaterThan(0);
  });

  it('tenant isolation: publishProduct for unknown product returns null', async () => {
    const row = await tenantContext.runWith(ctx, () =>
      repo.publishProduct('00000000-0000-0000-0000-000000000000', USER_ID),
    );
    expect(row).toBeNull();
  });
});
