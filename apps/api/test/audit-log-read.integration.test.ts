/**
 * Integration tests for AuditLogRepository.findPaginated (Story 1.6 read path).
 *
 * Uses Testcontainers (real PostgreSQL) + real migrations to exercise:
 *   - Correct total counts
 *   - Pagination (page 1 / page 2)
 *   - Tenant isolation via RLS (shop B cannot see shop A events)
 *   - Category filter returns only matching actions
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { AuditLogRepository } from '../src/modules/auth/audit-log.repository';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let container: StartedPostgreSqlContainer;
/** Superuser pool — bypasses RLS; used for seed inserts and migration. */
let superPool: Pool;
/** App pool created via createPool — sets poison GUC on-connect (used by withTenantTx). */
let appPool: Pool;
let repo: AuditLogRepository;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  superPool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(superPool, resolve(__dirname, '../../../packages/db/src/migrations'));
  // appPool uses createPool so its on-connect hook sets the poison GUC — same as production.
  appPool = createPool({ connectionString: container.getConnectionUri() });
  repo = new AuditLogRepository(appPool);
}, 120_000);

afterAll(async () => {
  await appPool?.end();
  await superPool?.end();
  await container?.stop();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Insert a shop as superuser. Returns shopId. */
async function seedShop(slug: string): Promise<string> {
  const r = await superPool.query<{ id: string }>(
    `INSERT INTO shops (slug, display_name, status)
     VALUES ($1, $2, 'ACTIVE')
     RETURNING id`,
    [slug, `Shop ${slug}`],
  );
  return r.rows[0]!.id;
}

/**
 * Insert a shop_user as superuser. Returns userId.
 * The user is needed so audit_events can FK to it (actor_user_id may be null,
 * but the LEFT JOIN in findPaginated just returns nulls — we don't require it).
 * For simplicity we use actor_user_id = NULL in audit rows.
 */
async function seedAuditEvents(
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- test seeder, not production code
  shopId: string,
  actions: string[],
  /** How many days in the past (0 = now). Audit rows must be within the default 30d window. */
  daysAgo = 0,
): Promise<void> {
  const ts = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  for (const action of actions) {
    await superPool.query(
      `INSERT INTO audit_events (shop_id, action, subject_type, created_at)
       VALUES ($1, $2, 'shop_user', $3)`,
      [shopId, action, ts],
    );
  }
}

/** Run findPaginated inside the given shop's tenant context. */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- return type inferred from repo call
async function findInContext(
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param -- test harness, not production code
  shopId: string,
  filters: Parameters<AuditLogRepository['findPaginated']>[0],
) {
  const ctx: AuthenticatedTenantContext = {
    authenticated: true,
    shopId,
    // tenant shape only needs id for withTenantTx; other fields are unused by the query.
    tenant: { id: shopId, slug: 'test', display_name: 'Test', status: 'ACTIVE' },
    userId: '00000000-0000-0000-0000-000000000001',
    role: 'shop_admin',
  };
  return tenantContext.runWith(ctx, () => repo.findPaginated(filters));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditLogRepository.findPaginated', () => {
  it('returns total matching the inserted rows', async () => {
    const shopId = await seedShop(`audit-total-${Date.now()}`);
    await seedAuditEvents(shopId, [
      'AUTH_VERIFY_SUCCESS',
      'AUTH_VERIFY_SUCCESS',
      'AUTH_VERIFY_SUCCESS',
      'AUTH_VERIFY_SUCCESS',
      'AUTH_VERIFY_SUCCESS',
    ]);

    const result = await findInContext(shopId, { page: 1, pageSize: 10 });

    expect(result.total).toBe(5);
    expect(result.events).toHaveLength(5);
  });

  it('paginates correctly — page 2 returns the second batch', async () => {
    const shopId = await seedShop(`audit-page-${Date.now()}`);
    // Insert 15 events
    await seedAuditEvents(
      shopId,
      Array.from({ length: 15 }, (_, i) => (i % 2 === 0 ? 'AUTH_VERIFY_SUCCESS' : 'STAFF_INVITED')),
    );

    const page1 = await findInContext(shopId, { page: 1, pageSize: 10 });
    const page2 = await findInContext(shopId, { page: 2, pageSize: 10 });

    expect(page1.total).toBe(15);
    expect(page1.events).toHaveLength(10);

    expect(page2.total).toBe(15);
    expect(page2.events).toHaveLength(5);

    // No overlap — IDs must be disjoint
    const ids1 = new Set(page1.events.map((e) => e.id));
    const ids2 = new Set(page2.events.map((e) => e.id));
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  it('tenant isolation: shop B context returns 0 events from shop A data', async () => {
    const shopIdA = await seedShop(`audit-iso-a-${Date.now()}`);
    const shopIdB = await seedShop(`audit-iso-b-${Date.now()}`);

    // Insert 3 events for shop A only
    await seedAuditEvents(shopIdA, ['AUTH_VERIFY_SUCCESS', 'STAFF_INVITED', 'AUTH_LOGOUT_ALL']);

    // Query from shop B's tenant context — RLS must return nothing
    const result = await findInContext(shopIdB, { page: 1, pageSize: 10 });

    expect(result.total).toBe(0);
    expect(result.events).toHaveLength(0);
  });

  it('filters by category — login category returns only login actions', async () => {
    const shopId = await seedShop(`audit-cat-${Date.now()}`);
    await seedAuditEvents(shopId, [
      'AUTH_VERIFY_SUCCESS', // login
      'AUTH_VERIFY_SUCCESS', // login
      'STAFF_INVITED',       // staff
    ]);

    const loginResult = await findInContext(shopId, { page: 1, pageSize: 10, category: 'login' });
    const staffResult = await findInContext(shopId, { page: 1, pageSize: 10, category: 'staff' });

    expect(loginResult.total).toBe(2);
    expect(loginResult.events.every((e) => e.action === 'AUTH_VERIFY_SUCCESS')).toBe(true);

    expect(staffResult.total).toBe(1);
    expect(staffResult.events[0]?.action).toBe('STAFF_INVITED');
  });
});
