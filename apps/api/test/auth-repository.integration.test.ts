import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';
import { AuthRepository } from '../src/modules/auth/auth.repository';
import type { Tenant } from '@goldsmith/tenant-context';

describe('AuthRepository', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let repo: AuthRepository;
  const SHOP_ID = '22222222-2222-2222-2222-222222222222';
  const PHONE = '+919000007002';
  const tenant: Tenant = { id: SHOP_ID, slug: 'fixture-repo', display_name: 'Repo', status: 'ACTIVE' };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
    repo = new AuthRepository(pool);
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, $2, $3, 'ACTIVE') ON CONFLICT DO NOTHING`,
      [SHOP_ID, tenant.slug, tenant.display_name],
    );
  }, 120_000);
  afterAll(async () => { await pool?.end(); await container?.stop(); });

  beforeEach(async () => {
    await pool.query('DELETE FROM shop_users WHERE phone = $1', [PHONE]);
  });

  it('lookupByPhone returns row for provisioned phone', async () => {
    await pool.query(
      `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
       VALUES ($1, $2, 'T', 'shop_admin', 'INVITED')`,
      [SHOP_ID, PHONE],
    );
    const r = await repo.lookupByPhone(PHONE);
    expect(r).not.toBeNull();
    expect(r!.shopId).toBe(SHOP_ID);
    expect(r!.status).toBe('INVITED');
    expect(r!.firebaseUid).toBeNull();
  });

  it('lookupByPhone returns null for unknown phone', async () => {
    await expect(repo.lookupByPhone('+911111111111')).resolves.toBeNull();
  });

  it('lookupByPhone returns null for SUSPENDED shop', async () => {
    const SUS_ID = '33333333-3333-3333-3333-333333333333';
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'sus-shop', 'Sus', 'SUSPENDED') ON CONFLICT DO NOTHING`,
      [SUS_ID],
    );
    await pool.query(
      `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
       VALUES ($1, '+910000000099', 'T', 'shop_admin', 'INVITED')`,
      [SUS_ID],
    );
    await expect(repo.lookupByPhone('+910000000099')).resolves.toBeNull();
  });

  it('linkFirebaseUid updates shop_users via tenant ctx + withTenantTx', async () => {
    const inserted = await pool.query(
      `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
       VALUES ($1, $2, 'T', 'shop_admin', 'INVITED') RETURNING id`,
      [SHOP_ID, PHONE],
    );
    const userId = inserted.rows[0].id;
    await repo.linkFirebaseUid({ shopId: SHOP_ID, userId, firebaseUid: 'uid-test-001', tenant });
    const r = await pool.query('SELECT firebase_uid, status, activated_at FROM shop_users WHERE id = $1', [userId]);
    expect(r.rows[0].firebase_uid).toBe('uid-test-001');
    expect(r.rows[0].status).toBe('ACTIVE');
    expect(r.rows[0].activated_at).not.toBeNull();
  });
});
