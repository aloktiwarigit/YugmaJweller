// apps/api/test/dpdpa-self-deletion-cascade.integration.test.ts
//
// Story 19.7 — customer-self DPDPA cascade + schema gap fixes.
// UUID prefix dd75xxxx — non-overlapping with other test files.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext, type Tenant, type AuthenticatedTenantContext } from '@goldsmith/tenant-context';

const SHOP_A     = 'dd750001-0000-4000-8000-000000000001';
const SHOP_B     = 'dd750001-0000-4000-8000-0000000000bb';
const CUSTOMER_A = 'dd750001-0000-4000-8000-0000000000c1';
const CUSTOMER_B = 'dd750001-0000-4000-8000-0000000000c2';
const USER_A     = 'dd750001-0000-4000-8000-0000000000a1';
const PRODUCT_A  = 'dd750001-0000-4000-8000-0000000000d1';

const tenantA: Tenant = { id: SHOP_A, slug: 'dpdpa-a', display_name: 'Shop A', status: 'ACTIVE' };
const tenantB: Tenant = { id: SHOP_B, slug: 'dpdpa-b', display_name: 'Shop B', status: 'ACTIVE' };
const ctxA: AuthenticatedTenantContext = { authenticated: true, shopId: SHOP_A, userId: USER_A, role: 'shop_admin', tenant: tenantA };
const ctxB: AuthenticatedTenantContext = { authenticated: true, shopId: SHOP_B, userId: USER_A, role: 'shop_admin', tenant: tenantB };

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));

  // Seed both shops (admin path — no RLS)
  const c = await pool.connect();
  try {
    for (const [id, slug, name] of [[SHOP_A, 'dpdpa-a', 'Shop A'], [SHOP_B, 'dpdpa-b', 'Shop B']] as const) {
      await c.query(
        `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, $2, $3, 'ACTIVE')`,
        [id, slug, name],
      );
    }
  } finally {
    c.release();
  }
}, 180_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ──────────────────────────────────────────────────────────────────────────────
// WS-A: Migration 0075 schema assertions
// ──────────────────────────────────────────────────────────────────────────────

describe('migration 0075: schema gaps', () => {
  it('customers.deletion_reason column exists and accepts allowed values', async () => {
    const c = await pool.connect();
    try {
      const r = await c.query<{ column_name: string; is_nullable: string }>(
        `SELECT column_name, is_nullable FROM information_schema.columns
         WHERE table_name = 'customers' AND column_name = 'deletion_reason'`,
      );
      expect(r.rows[0]?.column_name).toBe('deletion_reason');
      expect(r.rows[0]?.is_nullable).toBe('YES');

      // CHECK constraint allows the 4 enum values + NULL; rejects others.
      const r2 = await c.query<{ check_clause: string }>(
        `SELECT cc.check_clause
         FROM information_schema.check_constraints cc
         JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
         WHERE ccu.table_name = 'customers' AND ccu.column_name = 'deletion_reason'`,
      );
      expect(r2.rows[0]?.check_clause).toMatch(/no-need/);
      expect(r2.rows[0]?.check_clause).toMatch(/privacy/);
      expect(r2.rows[0]?.check_clause).toMatch(/other-jeweller/);
      // `'other'` must appear as its own IN-list element, not as a substring of 'other-jeweller'.
      // PostgreSQL normalises IN(...) to ANY(ARRAY[...]), so check_clause looks like:
      //   ...'other-jeweller'::text, 'other'::text]))
      // The negative lookahead ensures we match the standalone 'other', not 'other-jeweller'.
      expect(r2.rows[0]?.check_clause).toMatch(/'other'(?!-)/);

      // deletion_reason_text column + length guard
      const r3 = await c.query<{ column_name: string; is_nullable: string }>(
        `SELECT column_name, is_nullable FROM information_schema.columns
         WHERE table_name = 'customers' AND column_name = 'deletion_reason_text'`,
      );
      expect(r3.rows[0]?.column_name).toBe('deletion_reason_text');
      expect(r3.rows[0]?.is_nullable).toBe('YES');

      const r4 = await c.query<{ check_clause: string }>(
        `SELECT cc.check_clause
         FROM information_schema.check_constraints cc
         JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
         WHERE ccu.table_name = 'customers' AND ccu.column_name = 'deletion_reason_text'`,
      );
      expect(r4.rows[0]?.check_clause).toMatch(/length\(deletion_reason_text\)\s*<=\s*200/);
    } finally {
      c.release();
    }
  });

  it('product_reviews.customer_id is NULLABLE with ON DELETE SET NULL', async () => {
    const c = await pool.connect();
    try {
      const r = await c.query<{ is_nullable: string }>(
        `SELECT is_nullable FROM information_schema.columns
         WHERE table_name = 'product_reviews' AND column_name = 'customer_id'`,
      );
      expect(r.rows[0]?.is_nullable).toBe('YES');

      const r2 = await c.query<{ delete_rule: string }>(
        `SELECT rc.delete_rule
         FROM information_schema.referential_constraints rc
         JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
         WHERE kcu.table_name = 'product_reviews' AND kcu.column_name = 'customer_id'`,
      );
      expect(r2.rows[0]?.delete_rule).toBe('SET NULL');
    } finally {
      c.release();
    }
  });

  it('try_at_home_bookings.status enum includes CANCELLED', async () => {
    const c = await pool.connect();
    try {
      const r = await c.query<{ check_clause: string }>(
        `SELECT cc.check_clause
         FROM information_schema.check_constraints cc
         JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
         WHERE ccu.table_name = 'try_at_home_bookings' AND ccu.column_name = 'status'`,
      );
      expect(r.rows[0]?.check_clause).toMatch(/CANCELLED/);
    } finally {
      c.release();
    }
  });

  it('rate_lock_bookings.customer_id is NULLABLE with ON DELETE SET NULL', async () => {
    const c = await pool.connect();
    try {
      const r = await c.query<{ is_nullable: string }>(
        `SELECT is_nullable FROM information_schema.columns
         WHERE table_name = 'rate_lock_bookings' AND column_name = 'customer_id'`,
      );
      expect(r.rows[0]?.is_nullable).toBe('YES');

      const r2 = await c.query<{ delete_rule: string }>(
        `SELECT rc.delete_rule
         FROM information_schema.referential_constraints rc
         JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
         WHERE kcu.table_name = 'rate_lock_bookings' AND kcu.column_name = 'customer_id'`,
      );
      expect(r2.rows[0]?.delete_rule).toBe('SET NULL');
    } finally {
      c.release();
    }
  });

  it('try_at_home_bookings.customer_id is NULLABLE with ON DELETE SET NULL', async () => {
    const c = await pool.connect();
    try {
      const r = await c.query<{ is_nullable: string }>(
        `SELECT is_nullable FROM information_schema.columns
         WHERE table_name = 'try_at_home_bookings' AND column_name = 'customer_id'`,
      );
      expect(r.rows[0]?.is_nullable).toBe('YES');

      const r2 = await c.query<{ delete_rule: string }>(
        `SELECT rc.delete_rule
         FROM information_schema.referential_constraints rc
         JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
         WHERE kcu.table_name = 'try_at_home_bookings' AND kcu.column_name = 'customer_id'`,
      );
      expect(r2.rows[0]?.delete_rule).toBe('SET NULL');
    } finally {
      c.release();
    }
  });
});
