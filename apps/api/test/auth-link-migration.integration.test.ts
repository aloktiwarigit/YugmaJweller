import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';

describe('0003_auth_link migration', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
  }, 120_000);
  afterAll(async () => { await pool?.end(); await container?.stop(); });

  it('shop_users has firebase_uid column with unique partial index', async () => {
    const c = await pool.connect();
    try {
      const colRes = await c.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'shop_users' AND column_name = 'firebase_uid'
      `);
      expect(colRes.rows[0]).toEqual({ data_type: 'text' });

      const idxRes = await c.query(`
        SELECT indexdef FROM pg_indexes
        WHERE tablename = 'shop_users' AND indexname = 'shop_users_firebase_uid_uq'
      `);
      expect(idxRes.rows[0].indexdef).toMatch(/WHERE.*firebase_uid IS NOT NULL/i);
    } finally { c.release(); }
  });

  it('shop_users has activated_at TIMESTAMPTZ column', async () => {
    const c = await pool.connect();
    try {
      const r = await c.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'shop_users' AND column_name = 'activated_at'
      `);
      expect(r.rows[0]?.data_type).toBe('timestamp with time zone');
    } finally { c.release(); }
  });

  it('auth_rate_limits table exists, has no RLS, phone_e164 is PK', async () => {
    const c = await pool.connect();
    try {
      const rls = await c.query(`
        SELECT relrowsecurity FROM pg_class WHERE relname = 'auth_rate_limits'
      `);
      expect(rls.rows[0].relrowsecurity).toBe(false);
      const pk = await c.query(`
        SELECT a.attname FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'auth_rate_limits'::regclass AND i.indisprimary
      `);
      expect(pk.rows.map((r: { attname: string }) => r.attname)).toEqual(['phone_e164']);
    } finally { c.release(); }
  });

  it('platform_audit_events table is append-only for app_user (INSERT+SELECT, no UPDATE/DELETE)', async () => {
    const c = await pool.connect();
    try {
      const g = await c.query(`
        SELECT privilege_type FROM information_schema.table_privileges
        WHERE grantee = 'app_user' AND table_name = 'platform_audit_events'
        ORDER BY privilege_type
      `);
      const privs = g.rows.map((r: { privilege_type: string }) => r.privilege_type);
      expect(privs).toEqual(['INSERT', 'SELECT']);
    } finally { c.release(); }
  });

  it('auth_lookup_user_by_phone SECURITY DEFINER fn returns row for provisioned phone', async () => {
    const c = await pool.connect();
    try {
      await c.query(`INSERT INTO shops (id, slug, display_name, status)
                     VALUES ('11111111-1111-1111-1111-111111111111', 'fixture-3', 'F3', 'ACTIVE')
                     ON CONFLICT (id) DO NOTHING`);
      await c.query(`INSERT INTO shop_users (shop_id, phone, display_name, role, status)
                     VALUES ('11111111-1111-1111-1111-111111111111', '+919000000003', 'T', 'shop_admin', 'INVITED')
                     ON CONFLICT DO NOTHING`);
      await c.query('SET ROLE app_user');
      const r = await c.query("SELECT * FROM auth_lookup_user_by_phone('+919000000003')");
      expect(r.rows.length).toBe(1);
      expect(r.rows[0].shop_id).toBe('11111111-1111-1111-1111-111111111111');
      expect(r.rows[0].status).toBe('INVITED');
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  });

  it('tenant_boot_lookup SECURITY DEFINER fn returns config for ACTIVE shop', async () => {
    const c = await pool.connect();
    try {
      await c.query('SET ROLE app_user');
      const r = await c.query("SELECT * FROM tenant_boot_lookup('fixture-3')");
      expect(r.rows.length).toBe(1);
      expect(r.rows[0].display_name).toBe('F3');
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  });
});
