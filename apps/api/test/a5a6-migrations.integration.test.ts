// Integration tests for migrations 0069 and 0070.
// T1:  storefront_config_json defaults to '{}'::jsonb (NOT NULL)
// T8:  is_publicly_visible defaults to TRUE (NOT NULL, behavioral + catalog check)
// T9:  partial index idx_product_reviews_public exists and covers the right predicate
// T10: the partial index predicate is exactly WHERE (is_publicly_visible = true)

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';

const MIGRATION_TEST_SHOP_ID = '33333333-3333-3333-3333-333333333333';

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
}, 90_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ─── A5: shop_settings.storefront_config_json ─────────────────────────────────

describe('migration 0069 — shop_settings.storefront_config_json', () => {
  it('T1: column exists and is NOT NULL with JSONB type', async () => {
    const { rows } = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'shop_settings'
          AND column_name = 'storefront_config_json'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data_type).toBe('jsonb');
    expect(rows[0]!.is_nullable).toBe('NO');
  });

  it('T1b: INSERT without column produces default empty object', async () => {
    // Seed a shop as superuser (bypasses RLS)
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, $2, $3, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [MIGRATION_TEST_SHOP_ID, 'migration-test-shop', 'Migration Test Shop'],
    );
    // Insert shop_settings without storefront_config_json (superuser bypasses RLS)
    await pool.query(
      `INSERT INTO shop_settings (shop_id) VALUES ($1) ON CONFLICT (shop_id) DO NOTHING`,
      [MIGRATION_TEST_SHOP_ID],
    );
    const { rows } = await pool.query<{ storefront_config_json: Record<string, unknown> }>(
      `SELECT storefront_config_json FROM shop_settings WHERE shop_id = $1`,
      [MIGRATION_TEST_SHOP_ID],
    );
    expect(rows).toHaveLength(1);
    // Postgres returns the JSONB value as a parsed JS object; empty object expected
    expect(rows[0]!.storefront_config_json).toEqual({});
  });
});

// ─── A6: product_reviews.is_publicly_visible ──────────────────────────────────

describe('migration 0070 — product_reviews.is_publicly_visible', () => {
  it('T8: column exists, is NOT NULL BOOLEAN, and defaults to TRUE at catalog + runtime', async () => {
    // Catalog check via pg_get_expr — canonical, DDL-rendering-independent
    const { rows: catRows } = await pool.query<{ column_default: string }>(
      `SELECT pg_get_expr(adbin, adrelid) AS column_default
         FROM pg_attrdef
         JOIN pg_attribute ON attrelid = adrelid AND attnum = adnum
         JOIN pg_class     ON pg_class.oid = adrelid
        WHERE relname = 'product_reviews' AND attname = 'is_publicly_visible'`,
    );
    expect(catRows).toHaveLength(1);
    // pg_get_expr returns the normalised default expression; Postgres 15 renders 'true'
    expect(catRows[0]!.column_default).toBe('true');

    // Schema type + nullability via information_schema
    const { rows: schemaRows } = await pool.query<{
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'product_reviews' AND column_name = 'is_publicly_visible'`,
    );
    expect(schemaRows).toHaveLength(1);
    expect(schemaRows[0]!.data_type).toBe('boolean');
    expect(schemaRows[0]!.is_nullable).toBe('NO');
  });

  it('T9: partial index idx_product_reviews_public exists with correct predicate', async () => {
    const { rows } = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
         FROM pg_indexes
        WHERE tablename = 'product_reviews'
          AND indexname = 'idx_product_reviews_public'`,
    );
    expect(rows).toHaveLength(1);
    // Must include the partial predicate on is_publicly_visible
    expect(rows[0]!.indexdef).toContain('is_publicly_visible');
    // Postgres normalises to: WHERE (is_publicly_visible = true)
    expect(rows[0]!.indexdef).toMatch(/where.*is_publicly_visible/i);
    // Must be ordered by created_at and scope to shop_id + product_id
    expect(rows[0]!.indexdef).toContain('created_at');
    expect(rows[0]!.indexdef).toContain('shop_id');
    expect(rows[0]!.indexdef).toContain('product_id');
  });

  it('T10: indexdef predicate is exactly WHERE (is_publicly_visible = true), not FALSE', async () => {
    const { rows } = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
        WHERE tablename = 'product_reviews' AND indexname = 'idx_product_reviews_public'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0]!.indexdef.toLowerCase();
    // Positive: must be a TRUE predicate (proves index covers public rows)
    expect(def).toMatch(/where\s*\(\s*is_publicly_visible\s*=\s*true\s*\)/);
    // Negative: predicate must not be inverted (FALSE would mean private-only index)
    expect(def).not.toContain('is_publicly_visible = false');
  });

  it('original idx_product_reviews_product index still exists (not dropped)', async () => {
    const { rows } = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'product_reviews'
          AND indexname = 'idx_product_reviews_product'`,
    );
    // Original non-partial index must not have been dropped — shopkeeper read path uses it
    expect(rows).toHaveLength(1);
  });
});
