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

// ─── Phase B placeholder — activate when Story B4 ships ──────────────────────
//
// Story B4: GET /api/v1/catalog/products/:id/reviews
//   - filters WHERE is_publicly_visible = TRUE
//   - redacts customer name to first name only
//   - requires GRANT UPDATE on is_publicly_visible for shopkeeper opt-out
//
// Remove the `.skip` and implement these tests when B4 is implemented.

describe.skip('Phase B — public reviews endpoint uses is_publicly_visible filter', () => {
  it('GET /catalog/products/:id/reviews returns only is_publicly_visible=TRUE rows', async () => {
    // TODO in B4:
    // 1. Seed 2 reviews: one with is_publicly_visible=TRUE, one with FALSE
    // 2. Call GET /api/v1/catalog/products/:id/reviews with shop context
    // 3. Assert response.reviews.length === 1
    // 4. Assert the returned review is the TRUE one
    throw new Error('Implement in Story B4');
  });

  it('is_publicly_visible=FALSE row is excluded from public listing query', async () => {
    // TODO in B4:
    // 1. Seed a review with is_publicly_visible=FALSE
    // 2. Run the catalog read query directly (mirroring catalog.service)
    // 3. Assert the FALSE row does not appear in results
    // 4. Verify EXPLAIN uses idx_product_reviews_public (not seq scan)
    throw new Error('Implement in Story B4');
  });
});
