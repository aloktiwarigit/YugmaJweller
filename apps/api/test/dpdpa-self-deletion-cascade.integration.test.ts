// apps/api/test/dpdpa-self-deletion-cascade.integration.test.ts
//
// Story 19.7 — customer-self DPDPA cascade + schema gap fixes.
// UUID prefix dd75xxxx — non-overlapping with other test files.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations, withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import type { Tenant, AuthenticatedTenantContext } from '@goldsmith/tenant-context';

const SHOP_A = 'dd750001-0000-4000-8000-000000000001';
const SHOP_B = 'dd750001-0000-4000-8000-0000000000bb';
const USER_A = 'dd750001-0000-4000-8000-0000000000a1';

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
}, 300_000);

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

// ──────────────────────────────────────────────────────────────────────────────
// WS-F: full cascade against real Postgres
// ──────────────────────────────────────────────────────────────────────────────

describe('full cascade — softDeleteAtomic with all 4 child tables', () => {
  let customerId: string;
  let productId: string;
  let wishlistId: string;
  let reviewId: string;
  let rateLockId: string;
  let tryAtHomeId: string;

  beforeAll(async () => {
    // Seed: customer in shop A with one of each child table.
    const c = await pool.connect();
    try {
      await c.query(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
         VALUES ($1, '+919400000099', 'Owner A', 'shop_admin', 'ACTIVE')`,
        [SHOP_A],
      );
    } finally {
      c.release();
    }

    await tenantContext.runWith(ctxA, () => withTenantTx(pool, async (tx) => {
      const userRes = await tx.query<{ id: string }>(
        `SELECT id FROM shop_users WHERE shop_id = $1 LIMIT 1`,
        [SHOP_A],
      );
      const userId = userRes.rows[0]!.id;

      const cust = await tx.query<{ id: string }>(
        `INSERT INTO customers (shop_id, phone, name, created_by_user_id)
         VALUES ($1, '+919900000099', 'Priya', $2) RETURNING id`,
        [SHOP_A, userId],
      );
      customerId = cust.rows[0]!.id;

      const prod = await tx.query<{ id: string }>(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g,
            status, created_by_user_id, published_at, published_by_user_id)
         VALUES ($1, 'DD75-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000',
                 'IN_STOCK', $2, NOW(), $2) RETURNING id`,
        [SHOP_A, userId],
      );
      productId = prod.rows[0]!.id;

      const wl = await tx.query<{ id: string }>(
        `INSERT INTO wishlists (shop_id, customer_id, product_id) VALUES ($1, $2, $3) RETURNING id`,
        [SHOP_A, customerId, productId],
      );
      wishlistId = wl.rows[0]!.id;

      const rv = await tx.query<{ id: string }>(
        `INSERT INTO product_reviews (shop_id, product_id, customer_id, rating, review_text)
         VALUES ($1, $2, $3, 5, 'Excellent') RETURNING id`,
        [SHOP_A, productId, customerId],
      );
      reviewId = rv.rows[0]!.id;

      const rl = await tx.query<{ id: string }>(
        `INSERT INTO rate_lock_bookings
           (shop_id, customer_id, locked_rate_24k_paise_per_gram, expires_at,
            deposit_amount_paise, deposit_paid_paise, status)
         VALUES ($1, $2, 700000, NOW() + INTERVAL '1 day', 5000, 5000, 'ACTIVE') RETURNING id`,
        [SHOP_A, customerId],
      );
      rateLockId = rl.rows[0]!.id;

      const tah = await tx.query<{ id: string }>(
        `INSERT INTO try_at_home_bookings
           (shop_id, customer_id, product_ids, status)
         VALUES ($1, $2, ARRAY[$3]::uuid[], 'REQUESTED') RETURNING id`,
        [SHOP_A, customerId, productId],
      );
      tryAtHomeId = tah.rows[0]!.id;
    }));
  });

  it('cascades all four tables and returns expected counts', async () => {
    const { DpdpaDeletionRepository } = await import('../src/modules/crm/dpdpa-deletion.repository');
    const repo = new DpdpaDeletionRepository(pool);

    const result = await tenantContext.runWith(ctxA, () =>
      repo.softDeleteAtomic(customerId, 'customer', { reason: 'privacy' }),
    );

    expect(result.cascadeCounts.wishlists).toBe(1);
    expect(result.cascadeCounts.reviews).toBe(1);
    expect(result.cascadeCounts.rateLocks).toBe(1);
    expect(result.cascadeCounts.tryAtHome).toBe(1);
    expect(result.rateLockRefundsPending).toBe(1); // ACTIVE booking with deposit_paid_paise > 0

    // Wishlist gone
    const wlCheck = await pool.query(`SELECT 1 FROM wishlists WHERE id = $1`, [wishlistId]);
    expect(wlCheck.rowCount).toBe(0);

    // Review anonymised
    const rvCheck = await pool.query<{ customer_id: string | null }>(
      `SELECT customer_id FROM product_reviews WHERE id = $1`, [reviewId],
    );
    expect(rvCheck.rows[0]?.customer_id).toBeNull();

    // Rate-lock cancelled
    const rlCheck = await pool.query<{ status: string }>(
      `SELECT status FROM rate_lock_bookings WHERE id = $1`, [rateLockId],
    );
    expect(rlCheck.rows[0]?.status).toBe('CANCELLED');

    // Try-at-home cancelled
    const tahCheck = await pool.query<{ status: string }>(
      `SELECT status FROM try_at_home_bookings WHERE id = $1`, [tryAtHomeId],
    );
    expect(tahCheck.rows[0]?.status).toBe('CANCELLED');

    // Customer soft-deleted with reason
    const custCheck = await pool.query<{ deleted_at: Date; deletion_reason: string; deletion_requested_by: string; phone: string }>(
      `SELECT deleted_at, deletion_reason, deletion_requested_by, phone FROM customers WHERE id = $1`,
      [customerId],
    );
    expect(custCheck.rows[0]?.deleted_at).not.toBeNull();
    expect(custCheck.rows[0]?.deletion_reason).toBe('privacy');
    expect(custCheck.rows[0]?.deletion_requested_by).toBe('customer');
    // Phone is now SHA-256 hex (64 chars), not the original E.164
    expect(custCheck.rows[0]?.phone).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('tenant isolation', () => {
  it('deleting customer in shop A does not affect a same-phone customer in shop B', async () => {
    // Seed shop B's user + customer with the same phone as shop A's seeded one.
    let customerAId: string;
    let customerBId: string;

    const c = await pool.connect();
    try {
      await c.query(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
         VALUES ($1, '+919400000098', 'Owner B', 'shop_admin', 'ACTIVE')`,
        [SHOP_B],
      );
    } finally {
      c.release();
    }

    await tenantContext.runWith(ctxA, () => withTenantTx(pool, async (tx) => {
      const userARes = await tx.query<{ id: string }>(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
         VALUES ($1, '+919400000091', 'Owner A2', 'shop_admin', 'ACTIVE') RETURNING id`,
        [SHOP_A],
      );
      const userAId = userARes.rows[0]!.id;
      const c = await tx.query<{ id: string }>(
        `INSERT INTO customers (shop_id, phone, name, created_by_user_id)
         VALUES ($1, '+919900000100', 'Same Phone A', $2) RETURNING id`,
        [SHOP_A, userAId],
      );
      customerAId = c.rows[0]!.id;
    }));

    await tenantContext.runWith(ctxB, () => withTenantTx(pool, async (tx) => {
      const userBRes = await tx.query<{ id: string }>(
        `SELECT id FROM shop_users WHERE shop_id = $1 LIMIT 1`, [SHOP_B],
      );
      const userBId = userBRes.rows[0]!.id;
      const c = await tx.query<{ id: string }>(
        `INSERT INTO customers (shop_id, phone, name, created_by_user_id)
         VALUES ($1, '+919900000100', 'Same Phone B', $2) RETURNING id`,
        [SHOP_B, userBId],
      );
      customerBId = c.rows[0]!.id;
    }));

    const { DpdpaDeletionRepository } = await import('../src/modules/crm/dpdpa-deletion.repository');
    const repo = new DpdpaDeletionRepository(pool);

    // Delete A
    await tenantContext.runWith(ctxA, () => repo.softDeleteAtomic(customerAId!, 'customer'));

    // B untouched
    const bCheck = await pool.query<{ deleted_at: Date | null; name: string }>(
      `SELECT deleted_at, name FROM customers WHERE id = $1`, [customerBId!],
    );
    expect(bCheck.rows[0]?.deleted_at).toBeNull();
    expect(bCheck.rows[0]?.name).toBe('Same Phone B');
  });
});

describe('DISPATCHED try-at-home blocks deletion', () => {
  it('throws crm.deletion.try_at_home_in_flight when a booking is DISPATCHED', async () => {
    let customerId: string;

    await tenantContext.runWith(ctxA, () => withTenantTx(pool, async (tx) => {
      const userRes = await tx.query<{ id: string }>(
        `SELECT id FROM shop_users WHERE shop_id = $1 LIMIT 1`, [SHOP_A],
      );
      const userId = userRes.rows[0]!.id;
      const c = await tx.query<{ id: string }>(
        `INSERT INTO customers (shop_id, phone, name, created_by_user_id)
         VALUES ($1, '+919900000200', 'Customer Dispatched', $2) RETURNING id`,
        [SHOP_A, userId],
      );
      customerId = c.rows[0]!.id;
      const prodRes = await tx.query<{ id: string }>(
        `SELECT id FROM products WHERE shop_id = $1 LIMIT 1`, [SHOP_A],
      );
      const productId = prodRes.rows[0]!.id;
      await tx.query(
        `INSERT INTO try_at_home_bookings (shop_id, customer_id, product_ids, status)
         VALUES ($1, $2, ARRAY[$3]::uuid[], 'DISPATCHED')`,
        [SHOP_A, customerId, productId],
      );
    }));

    const { DpdpaDeletionRepository } = await import('../src/modules/crm/dpdpa-deletion.repository');
    const repo = new DpdpaDeletionRepository(pool);

    await expect(
      tenantContext.runWith(ctxA, () => repo.softDeleteAtomic(customerId!, 'customer')),
    ).rejects.toMatchObject({
      response: { code: 'crm.deletion.try_at_home_in_flight' },
    });

    // Customer NOT soft-deleted (block stopped the tx)
    const check = await pool.query<{ deleted_at: Date | null }>(
      `SELECT deleted_at FROM customers WHERE id = $1`, [customerId!],
    );
    expect(check.rows[0]?.deleted_at).toBeNull();
  });
});

describe('replay protection', () => {
  it('second softDeleteAtomic call returns crm.deletion.already_requested', async () => {
    let customerId: string;
    await tenantContext.runWith(ctxA, () => withTenantTx(pool, async (tx) => {
      const userRes = await tx.query<{ id: string }>(
        `SELECT id FROM shop_users WHERE shop_id = $1 LIMIT 1`, [SHOP_A],
      );
      const userId = userRes.rows[0]!.id;
      const c = await tx.query<{ id: string }>(
        `INSERT INTO customers (shop_id, phone, name, created_by_user_id)
         VALUES ($1, '+919900000300', 'Customer Replay', $2) RETURNING id`,
        [SHOP_A, userId],
      );
      customerId = c.rows[0]!.id;
    }));

    const { DpdpaDeletionRepository } = await import('../src/modules/crm/dpdpa-deletion.repository');
    const repo = new DpdpaDeletionRepository(pool);

    // First call succeeds
    await tenantContext.runWith(ctxA, () => repo.softDeleteAtomic(customerId!, 'customer'));

    // Second call rejects
    await expect(
      tenantContext.runWith(ctxA, () => repo.softDeleteAtomic(customerId!, 'customer')),
    ).rejects.toMatchObject({
      response: { code: 'crm.deletion.already_requested' },
    });
  });
});

describe('hard-delete after 30 days', () => {
  it('removes the customer row even with anonymised reviews and cancelled bookings', async () => {
    let customerId: string;
    let reviewId:   string;
    let rateLockId: string;
    let tahId:      string;

    await tenantContext.runWith(ctxA, () => withTenantTx(pool, async (tx) => {
      const userRes = await tx.query<{ id: string }>(
        `SELECT id FROM shop_users WHERE shop_id = $1 LIMIT 1`, [SHOP_A],
      );
      const userId = userRes.rows[0]!.id;
      const prodRes = await tx.query<{ id: string }>(
        `SELECT id FROM products WHERE shop_id = $1 LIMIT 1`, [SHOP_A],
      );
      const productId = prodRes.rows[0]!.id;
      const c = await tx.query<{ id: string }>(
        `INSERT INTO customers (shop_id, phone, name, created_by_user_id)
         VALUES ($1, '+919900000400', 'Customer Hard Delete', $2) RETURNING id`,
        [SHOP_A, userId],
      );
      customerId = c.rows[0]!.id;
      const rv = await tx.query<{ id: string }>(
        `INSERT INTO product_reviews (shop_id, product_id, customer_id, rating, review_text)
         VALUES ($1, $2, $3, 4, 'Good') RETURNING id`,
        [SHOP_A, productId, customerId],
      );
      reviewId = rv.rows[0]!.id;
      const rl = await tx.query<{ id: string }>(
        `INSERT INTO rate_lock_bookings
           (shop_id, customer_id, locked_rate_24k_paise_per_gram, expires_at,
            deposit_amount_paise, deposit_paid_paise, status)
         VALUES ($1, $2, 700000, NOW() + INTERVAL '1 day', 5000, 0, 'PENDING_PAYMENT') RETURNING id`,
        [SHOP_A, customerId],
      );
      rateLockId = rl.rows[0]!.id;
      const tah = await tx.query<{ id: string }>(
        `INSERT INTO try_at_home_bookings (shop_id, customer_id, product_ids, status)
         VALUES ($1, $2, ARRAY[$3]::uuid[], 'REQUESTED') RETURNING id`,
        [SHOP_A, customerId, productId],
      );
      tahId = tah.rows[0]!.id;
    }));

    const { DpdpaDeletionRepository } = await import('../src/modules/crm/dpdpa-deletion.repository');
    const repo = new DpdpaDeletionRepository(pool);

    // Soft-delete first
    await tenantContext.runWith(ctxA, () => repo.softDeleteAtomic(customerId!, 'customer'));

    // Manually backdate hard_delete_scheduled_at so it's eligible
    await pool.query(
      `UPDATE customers SET hard_delete_scheduled_at = NOW() - INTERVAL '1 day' WHERE id = $1`,
      [customerId!],
    );

    // Hard-delete
    const ok = await tenantContext.runWith(ctxA, () => repo.hardDeleteAtomic(customerId!));
    expect(ok).toBe(true);

    // Customer gone
    const custCheck = await pool.query(`SELECT 1 FROM customers WHERE id = $1`, [customerId!]);
    expect(custCheck.rowCount).toBe(0);

    // Review still present with customer_id NULL (FK ON DELETE SET NULL did the work)
    const rvCheck = await pool.query<{ customer_id: string | null }>(
      `SELECT customer_id FROM product_reviews WHERE id = $1`, [reviewId!],
    );
    expect(rvCheck.rows[0]?.customer_id).toBeNull();

    // Rate-lock + try-at-home: present with CANCELLED status; customer_id
    // is now NULL because migration 0075 set the FK to ON DELETE SET NULL.
    // Shopkeeper retains the audit trail via status + locked_rate + dates.
    const rlCheck = await pool.query<{ status: string; customer_id: string | null }>(
      `SELECT status, customer_id FROM rate_lock_bookings WHERE id = $1`, [rateLockId!],
    );
    expect(rlCheck.rows[0]?.status).toBe('CANCELLED');
    expect(rlCheck.rows[0]?.customer_id).toBeNull();

    const tahCheck = await pool.query<{ status: string; customer_id: string | null }>(
      `SELECT status, customer_id FROM try_at_home_bookings WHERE id = $1`, [tahId!],
    );
    expect(tahCheck.rows[0]?.status).toBe('CANCELLED');
    expect(tahCheck.rows[0]?.customer_id).toBeNull();
  });
});
