import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';

describe('audit_events immutability (Story 1.6)', () => {
  let container: StartedPostgreSqlContainer;
  let superPool: Pool;   // superuser pool — used to insert seed rows
  let appPool: Pool;     // app_user-role pool — used to verify permission denials

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();

    // Use createPool to run migrations (it is the same helper used in rls-fail-loud tests).
    superPool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(superPool, resolve(__dirname, '../../../packages/db/src/migrations'));

    // A plain pool for app_user-impersonation tests (no on-connect hook).
    appPool = new Pool({ connectionString: container.getConnectionUri() });
  }, 120_000);

  afterAll(async () => {
    await appPool?.end();
    await superPool?.end();
    await container?.stop();
  });

  // ─── helpers ────────────────────────────────────────────────────────────────

  /** Insert a shop + audit_event row as superuser. Returns the audit event id. */
  async function seedAuditRow(): Promise<string> {
    // Insert a shop first (audit_events has FK to shops).
    const shopRes = await superPool.query<{ id: string }>(`
      INSERT INTO shops (slug, display_name, status)
      VALUES (
        'test-shop-' || gen_random_uuid()::text,
        'Test Shop',
        'ACTIVE'
      )
      RETURNING id
    `);
    const shopId = shopRes.rows[0]!.id;

    const evtRes = await superPool.query<{ id: string }>(
      `INSERT INTO audit_events (shop_id, action, subject_type)
       VALUES ($1, 'TEST_ACTION', 'test')
       RETURNING id`,
      [shopId],
    );
    return evtRes.rows[0]!.id;
  }

  // ─── tests ──────────────────────────────────────────────────────────────────

  it('UPDATE on audit_events as app_user role raises permission denied (42501)', async () => {
    const auditId = await seedAuditRow();

    // Fetch the shop_id for the seeded row so we can satisfy the RLS GUC.
    const { rows } = await superPool.query<{ shop_id: string }>(
      'SELECT shop_id FROM audit_events WHERE id = $1',
      [auditId],
    );
    const shopId = rows[0]!.shop_id;

    const c = await appPool.connect();
    try {
      // Use session-level SET so RLS can evaluate the GUC after SET ROLE.
      // SET does not accept parameterized values; shopId is a UUID from the DB (safe).
      await c.query(`SET "app.current_shop_id" = '${shopId}'`);
      await c.query('SET ROLE app_user');
      await expect(
        c.query(`UPDATE audit_events SET metadata = '{}' WHERE id = $1`, [auditId]),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  });

  it('DELETE on audit_events as app_user role raises permission denied (42501)', async () => {
    const auditId = await seedAuditRow();

    const { rows } = await superPool.query<{ shop_id: string }>(
      'SELECT shop_id FROM audit_events WHERE id = $1',
      [auditId],
    );
    const shopId = rows[0]!.shop_id;

    const c = await appPool.connect();
    try {
      // SET does not accept parameterized values; shopId is a UUID from the DB (safe).
      await c.query(`SET "app.current_shop_id" = '${shopId}'`);
      await c.query('SET ROLE app_user');
      await expect(
        c.query(`DELETE FROM audit_events WHERE id = $1`, [auditId]),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  });

  it('UPDATE on audit_events as superuser raises restrict_violation from trigger (23001)', async () => {
    const auditId = await seedAuditRow();

    // Superuser bypasses REVOKE but the SECURITY DEFINER trigger still fires.
    await expect(
      superPool.query(`UPDATE audit_events SET metadata = '{}' WHERE id = $1`, [auditId]),
    ).rejects.toMatchObject({ code: '23001' });
  });

  it('DELETE on audit_events as superuser raises restrict_violation from trigger (23001)', async () => {
    const auditId = await seedAuditRow();

    await expect(
      superPool.query(`DELETE FROM audit_events WHERE id = $1`, [auditId]),
    ).rejects.toMatchObject({ code: '23001' });
  });

  it('INSERT on audit_events still succeeds (append-only, not read-only)', async () => {
    const shopRes = await superPool.query<{ id: string }>(`
      INSERT INTO shops (slug, display_name, status)
      VALUES (
        'insert-test-' || gen_random_uuid()::text,
        'Insert Test Shop',
        'ACTIVE'
      )
      RETURNING id
    `);
    const shopId = shopRes.rows[0]!.id;

    await expect(
      superPool.query(
        `INSERT INTO audit_events (shop_id, action, subject_type)
         VALUES ($1, 'INSERT_ALLOWED', 'test')`,
        [shopId],
      ),
    ).resolves.toBeDefined();
  });
});
