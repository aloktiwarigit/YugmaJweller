// Integration tests for product_reviews.is_publicly_visible (migration 0070).
//
// Active tests: column shape, index existence (complementary to a5a6-migrations).
//
// Skipped tests (describe.skip): Phase B public reviews filter — lands when
//   Story B4 ships GET /api/v1/catalog/products/:id/reviews with is_publicly_visible filter.
//   The column and index MUST already exist before B4 can be implemented.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../../packages/db/src/migrations'));
}, 90_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('product_reviews.is_publicly_visible — column + index (Phase A)', () => {
  it('column is BOOLEAN NOT NULL DEFAULT TRUE', async () => {
    const { rows } = await pool.query<{
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'product_reviews'
          AND column_name = 'is_publicly_visible'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data_type).toBe('boolean');
    expect(rows[0]!.is_nullable).toBe('NO');
  });

  it('column DEFAULT is TRUE (opt-out DPDPA contract — preserves pre-existing public rows)', async () => {
    // pg_get_expr is the canonical source for default expressions — DDL-rendering-independent
    const { rows } = await pool.query<{ column_default: string }>(
      `SELECT pg_get_expr(adbin, adrelid) AS column_default
         FROM pg_attrdef
         JOIN pg_attribute ON attrelid = adrelid AND attnum = adnum
         JOIN pg_class     ON pg_class.oid = adrelid
        WHERE relname = 'product_reviews' AND attname = 'is_publicly_visible'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.column_default).toBe('true');
  });

  it('partial index idx_product_reviews_public exists with WHERE is_publicly_visible predicate', async () => {
    const { rows } = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE tablename = 'product_reviews' AND indexname = 'idx_product_reviews_public'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.indexdef).toContain('is_publicly_visible');
  });
});

// ─── Phase B — public reviews endpoint (Story B4) ────────────────────────────

describe('Phase B — GET /catalog/products/:id/reviews with is_publicly_visible filter', () => {
  const SHOP_A             = 'a0000000-0000-0000-0000-000000000001';
  const SHOP_B             = 'a0000000-0000-0000-0000-000000000002';
  const PRODUCT_A          = 'b0000000-0000-0000-0000-000000000001';
  const PRODUCT_B          = 'b0000000-0000-0000-0000-000000000002';
  const CUSTOMER_PRIYA     = 'c0000000-0000-0000-0000-000000000001'; // 'Priya Sharma'
  const CUSTOMER_REKHA     = 'c0000000-0000-0000-0000-000000000002'; // 'Rekha'
  const CUSTOMER_SUNITA    = 'c0000000-0000-0000-0000-000000000003'; // 'Sunita Patel'
  const CUSTOMER_ANITA     = 'c0000000-0000-0000-0000-000000000004'; // 'Anita Devi' (hidden)
  const CUSTOMER_MEENA     = 'c0000000-0000-0000-0000-000000000005'; // 'Meena' (hidden)
  const ORPHAN_UUID        = 'c0000000-0000-0000-0000-000000000099'; // never inserted
  const CREATOR_UUID       = 'f0000000-0000-0000-0000-000000000001'; // arbitrary creator id

  // SQL for the public reviews list query (mirrors catalog.service.getPublicProductReviews)
  const REVIEWS_SQL = `
    SELECT
      pr.id,
      pr.rating,
      pr.review_text,
      CASE
        WHEN c.name IS NULL THEN 'Anonymous'
        WHEN position(' ' IN c.name) = 0 THEN c.name
        ELSE split_part(c.name, ' ', 1) || ' ' || LEFT(split_part(c.name, ' ', -1), 1) || '.'
      END AS customer_display_name,
      pr.created_at
    FROM product_reviews pr
    LEFT JOIN customers c ON c.id = pr.customer_id AND c.shop_id = pr.shop_id
    WHERE pr.shop_id = $1
      AND pr.product_id = $2
      AND pr.is_publicly_visible = TRUE
    ORDER BY pr.created_at DESC
    LIMIT $3 OFFSET $4
  `;

  const BREAKDOWN_SQL = `
    SELECT rating, COUNT(*)::int AS cnt
      FROM product_reviews
     WHERE shop_id = $1
       AND product_id = $2
       AND is_publicly_visible = TRUE
     GROUP BY rating
  `;

  beforeAll(async () => {
    // Seed shops
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status)
       VALUES ($1, 'shop-a', 'Shop A', 'ACTIVE'),
              ($2, 'shop-b', 'Shop B', 'ACTIVE')
       ON CONFLICT DO NOTHING`,
      [SHOP_A, SHOP_B],
    );

    // Seed products (published)
    await pool.query(
      `INSERT INTO products
         (id, shop_id, sku, metal, purity, gross_weight_g, net_weight_g, created_by_user_id, published_at)
       VALUES
         ($1, $3, 'B4-P-A', 'GOLD', '22K', 5.0000, 4.5000, $4, NOW()),
         ($2, $3, 'B4-P-B', 'GOLD', '22K', 3.0000, 2.7000, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [PRODUCT_A, PRODUCT_B, SHOP_A, CREATOR_UUID],
    );

    // Seed customers
    await pool.query(
      `INSERT INTO customers (id, shop_id, phone, name, viewing_consent, created_by_user_id)
       VALUES
         ($1, $6, '9991111001', 'Priya Sharma', TRUE, $7),
         ($2, $6, '9991111002', 'Rekha',        TRUE, $7),
         ($3, $6, '9991111003', 'Sunita Patel', TRUE, $7),
         ($4, $6, '9991111004', 'Anita Devi',   TRUE, $7),
         ($5, $6, '9991111005', 'Meena',         TRUE, $7)
       ON CONFLICT DO NOTHING`,
      [CUSTOMER_PRIYA, CUSTOMER_REKHA, CUSTOMER_SUNITA, CUSTOMER_ANITA, CUSTOMER_MEENA,
       SHOP_A, CREATOR_UUID],
    );

    // Seed reviews for PRODUCT_A
    await pool.query(
      `INSERT INTO product_reviews (id, shop_id, product_id, customer_id, rating, is_publicly_visible)
       VALUES
         ('d0000000-0000-0000-0000-000000000001', $1, $2, $3, 5, TRUE),
         ('d0000000-0000-0000-0000-000000000002', $1, $2, $4, 4, TRUE),
         ('d0000000-0000-0000-0000-000000000003', $1, $2, $5, 3, TRUE),
         ('d0000000-0000-0000-0000-000000000004', $1, $2, $6, 2, FALSE),
         ('d0000000-0000-0000-0000-000000000005', $1, $2, $7, 1, FALSE)
       ON CONFLICT DO NOTHING`,
      [SHOP_A, PRODUCT_A, CUSTOMER_PRIYA, CUSTOMER_REKHA, CUSTOMER_SUNITA,
       CUSTOMER_ANITA, CUSTOMER_MEENA],
    );

    // Seed orphan review for PRODUCT_B (customer_id that doesn't exist — FK bypassed)
    await pool.query("SET session_replication_role = 'replica'");
    await pool.query(
      `INSERT INTO product_reviews (id, shop_id, product_id, customer_id, rating, is_publicly_visible)
       VALUES ('d0000000-0000-0000-0000-000000000006', $1, $2, $3, 4, TRUE)
       ON CONFLICT DO NOTHING`,
      [SHOP_A, PRODUCT_B, ORPHAN_UUID],
    );
    await pool.query("SET session_replication_role = 'origin'");
  });

  // ── Assertion 1: is_publicly_visible=FALSE rows excluded ───────────────────

  it('only returns is_publicly_visible=TRUE reviews — FALSE rows excluded', async () => {
    const { rows } = await pool.query(REVIEWS_SQL, [SHOP_A, PRODUCT_A, 10, 0]);
    // PRODUCT_A has 5 reviews: 3 visible, 2 hidden
    expect(rows).toHaveLength(3);
    const allVisible = rows.every((r: { customer_display_name: string }) =>
      // verify no hidden customer names appear
      r.customer_display_name !== 'Anita D.' && r.customer_display_name !== 'Meena',
    );
    expect(allVisible).toBe(true);
  });

  // ── Assertion 2: cross-tenant review isolation ──────────────────────────────

  it('returns empty for shop_b context querying shop_a product', async () => {
    // PRODUCT_A belongs to SHOP_A. Querying with SHOP_B shop_id finds nothing.
    const { rows } = await pool.query(REVIEWS_SQL, [SHOP_B, PRODUCT_A, 10, 0]);
    expect(rows).toHaveLength(0);
  });

  // ── Assertion 3: PII redaction — full name → first + initial ───────────────

  it('PII: full name Priya Sharma is redacted to Priya S.', async () => {
    const { rows } = await pool.query<{ customer_display_name: string }>(
      REVIEWS_SQL, [SHOP_A, PRODUCT_A, 10, 0],
    );
    const priyaRow = rows.find((r) => r.customer_display_name === 'Priya S.');
    expect(priyaRow).toBeDefined();
    // Full name must never appear
    const fullNameLeaked = rows.some((r) =>
      r.customer_display_name.includes('Sharma'),
    );
    expect(fullNameLeaked).toBe(false);
  });

  // ── Assertion 4: PII redaction — single-token name ─────────────────────────

  it('PII: single-token name Rekha is returned as-is (no dot, no crash)', async () => {
    const { rows } = await pool.query<{ customer_display_name: string }>(
      REVIEWS_SQL, [SHOP_A, PRODUCT_A, 10, 0],
    );
    const rekhaRow = rows.find((r) => r.customer_display_name === 'Rekha');
    expect(rekhaRow).toBeDefined();
  });

  // ── Assertion 5: PII redaction — orphan customer → Anonymous ───────────────

  it('PII: missing customer row (LEFT JOIN miss) returns Anonymous', async () => {
    // PRODUCT_B has a review with customer_id = ORPHAN_UUID (not in customers table)
    const { rows } = await pool.query<{ customer_display_name: string }>(
      REVIEWS_SQL, [SHOP_A, PRODUCT_B, 10, 0],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].customer_display_name).toBe('Anonymous');
  });

  // ── Assertion 6: ratingBreakdown counts only visible reviews ───────────────

  it('breakdown totals 3 (only visible reviews counted; 2 hidden excluded)', async () => {
    const { rows } = await pool.query<{ rating: number; cnt: number }>(
      BREAKDOWN_SQL, [SHOP_A, PRODUCT_A],
    );
    const total = rows.reduce((sum, r) => sum + r.cnt, 0);
    // 3 visible reviews (ratings 5, 4, 3); 2 hidden (ratings 2, 1) excluded
    expect(total).toBe(3);
    const ratingMap = Object.fromEntries(rows.map((r) => [r.rating, r.cnt]));
    expect(ratingMap[5]).toBe(1);
    expect(ratingMap[4]).toBe(1);
    expect(ratingMap[3]).toBe(1);
    expect(ratingMap[2]).toBeUndefined(); // hidden, not counted
    expect(ratingMap[1]).toBeUndefined(); // hidden, not counted
  });

  // ── Assertion 7: partial index idx_product_reviews_public used in EXPLAIN ──

  it('EXPLAIN uses idx_product_reviews_public (not a seq scan) for the public filter', async () => {
    const client = await (pool as import('pg').Pool).connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const { rows } = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN ${REVIEWS_SQL}`,
        [SHOP_A, PRODUCT_A, 10, 0],
      );
      await client.query('ROLLBACK');
      const plan = rows.map((r) => r['QUERY PLAN']).join('\n');
      expect(plan).toContain('idx_product_reviews_public');
    } finally {
      client.release();
    }
  });
});
