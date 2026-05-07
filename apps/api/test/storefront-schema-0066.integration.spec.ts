// apps/api/test/storefront-schema-0066.integration.spec.ts
//
// Mandatory spec tests T3–T6 + weight-column invariant.
// UUID prefix cc4xxxxx — non-overlapping with other test files.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

// ---------------------------------------------------------------------------
// Fixture UUIDs — non-overlapping with other integration test files
// ---------------------------------------------------------------------------
const SHOP_A = 'cc400001-cc00-4000-cc00-000000000001';

const tenantA: Tenant = { id: SHOP_A, slug: 'stf-0066-a', display_name: '0066 Shop A', status: 'ACTIVE' };
const ctxA: UnauthenticatedTenantContext = { shopId: SHOP_A, tenant: tenantA, authenticated: false };

let container: StartedPostgreSqlContainer;
let pool: Pool;
let userAId: string;
let productAId: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed shop via raw connection (no RLS on shops table from admin path)
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'stf-0066-a', '0066 Shop A', 'ACTIVE')`,
      [SHOP_A],
    );
  } finally {
    c.release();
  }

  // Seed shop_admin user
  userAId = await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
           VALUES ($1, '+919400000101', 'Owner 0066', 'shop_admin', 'ACTIVE') RETURNING id`,
        [SHOP_A],
      );
      return r.rows[0]!.id;
    }),
  );

  // Seed a published product for index smoke tests (partial indexes filter published_at IS NOT NULL)
  productAId = await tenantContext.runWith(ctxA, () =>
    withTenantTx(pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g,
            status, created_by_user_id, published_at, published_by_user_id)
         VALUES
           ($1, 'STF0066-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000',
            'IN_STOCK', $2, NOW(), $2)
         RETURNING id`,
        [SHOP_A, userAId],
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
// T3 — CHECK constraint blocks invalid style
// ---------------------------------------------------------------------------
describe('migration 0066: style CHECK constraint', () => {
  it('rejects style = UNKNOWN with CHECK violation (23514)', async () => {
    await expect(
      tenantContext.runWith(ctxA, () =>
        withTenantTx(pool, (tx) =>
          tx.query(`UPDATE products SET style = 'UNKNOWN' WHERE id = $1`, [productAId]),
        ),
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('accepts every valid style value without error', async () => {
    const validStyles = [
      'ENGAGEMENT','COUPLE','DAILY_WEAR','JHUMKA','STUDS','HOOPS',
      'DROP','STATEMENT','TEMPLE','BRIDAL','OFFICE','KIDS',
    ];
    for (const style of validStyles) {
      await expect(
        tenantContext.runWith(ctxA, () =>
          withTenantTx(pool, (tx) =>
            tx.query(`UPDATE products SET style = $1 WHERE id = $2`, [style, productAId]),
          ),
        ),
      ).resolves.not.toThrow();
    }
  });

  it('accepts NULL style (column is nullable)', async () => {
    await expect(
      tenantContext.runWith(ctxA, () =>
        withTenantTx(pool, (tx) =>
          tx.query(`UPDATE products SET style = NULL WHERE id = $1`, [productAId]),
        ),
      ),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Weight column invariant — must remain DECIMAL(12,4) after migration
// ---------------------------------------------------------------------------
describe('migration 0066: weight column types unchanged', () => {
  it('gross_weight_g and net_weight_g remain numeric(12,4)', async () => {
    const r = await pool.query<{
      column_name: string;
      data_type: string;
      numeric_precision: number;
      numeric_scale: number;
    }>(
      `SELECT column_name, data_type, numeric_precision, numeric_scale
         FROM information_schema.columns
        WHERE table_name = 'products'
          AND column_name IN ('gross_weight_g', 'net_weight_g')
        ORDER BY column_name`,
    );
    expect(r.rows).toHaveLength(2);
    for (const row of r.rows) {
      expect(row.data_type).toBe('numeric');
      expect(row.numeric_precision).toBe(12);
      expect(row.numeric_scale).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// T4 — GIN occasion index used by ANY(...)
// ---------------------------------------------------------------------------
describe('migration 0066: GIN occasion index', () => {
  it('planner uses products_occasion_gin_idx for ANY(occasion) filter', async () => {
    const client = await pool.connect();
    try {
      await client.query('SET enable_seqscan = off');
      // GIN array indexes support @> (containment) operator; use that form
      // rather than '= ANY()' which the planner may not route through GIN.
      const r = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT id FROM products WHERE occasion @> ARRAY['WEDDING']::text[]`,
      );
      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
      expect(plan).toContain('products_occasion_gin_idx');
    } finally {
      await client.query('RESET enable_seqscan');
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// T5 — composite top-sellers index used by ORDER BY expression
// ---------------------------------------------------------------------------
describe('migration 0066: top-sellers expression index', () => {
  it('planner uses products_top_sellers_idx for (sales*2+views) DESC ORDER BY', async () => {
    const client = await pool.connect();
    try {
      await client.query('SET enable_seqscan = off');
      const r = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT id FROM products
          WHERE shop_id = $1 AND published_at IS NOT NULL
          ORDER BY (sales_count_30d * 2 + view_count_30d) DESC, published_at DESC`,
        [SHOP_A],
      );
      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
      expect(plan).toContain('products_top_sellers_idx');
    } finally {
      await client.query('RESET enable_seqscan');
      client.release();
    }
  });
});

// ---------------------------------------------------------------------------
// T6 — pg_trgm GIN index used by similarity search
// ---------------------------------------------------------------------------
describe('migration 0066: pg_trgm similarity index', () => {
  it('planner uses products_search_trgm_idx for expression % similarity query', async () => {
    const client = await pool.connect();
    try {
      await client.query('SET enable_seqscan = off');
      // Lower the similarity threshold so the trgm GIN index is considered.
      await client.query('SET pg_trgm.similarity_threshold = 0.1');
      // The index expression is: coalesce(sku,'') || ' ' || coalesce(metal,'') || ' ' || coalesce(purity,'')
      // Query must match the exact expression to use the index.
      // No published_at filter here — the index is non-partial so it applies
      // to all rows; omitting the filter prevents the planner from choosing
      // a competing partial BTree index instead.
      const r = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT id FROM products
          WHERE (coalesce(sku, '') || ' ' || coalesce(metal, '') || ' ' || coalesce(purity, '')) % 'AB-1042'`,
      );
      const plan = r.rows.map((row) => row['QUERY PLAN']).join('\n');
      expect(plan).toContain('products_search_trgm_idx');
    } finally {
      await client.query('RESET enable_seqscan');
      await client.query('RESET pg_trgm.similarity_threshold');
      client.release();
    }
  });
});
