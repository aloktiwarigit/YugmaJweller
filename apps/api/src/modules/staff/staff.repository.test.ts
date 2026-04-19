import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Pool } from 'pg';
import { StaffRepository } from './staff.repository';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext, Tenant } from '@goldsmith/tenant-context';

let container: StartedTestContainer;
let pool: Pool;
let repo: StaffRepository;

const TENANT_A: Tenant = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', slug: 'shop-a', display_name: 'Shop A', status: 'ACTIVE' };
const TENANT_B: Tenant = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', slug: 'shop-b', display_name: 'Shop B', status: 'ACTIVE' };
const OWNER_A_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function ctxA(): AuthenticatedTenantContext {
  return { shopId: TENANT_A.id, tenant: TENANT_A, authenticated: true, userId: OWNER_A_ID, role: 'shop_admin' };
}

beforeAll(async () => {
  container = await new GenericContainer('postgres:15-alpine')
    .withEnvironment({ POSTGRES_DB: 'test', POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'postgres' })
    .withExposedPorts(5432)
    .start();

  pool = new Pool({
    host: container.getHost(),
    port: container.getMappedPort(5432),
    database: 'test',
    user: 'postgres',
    password: 'postgres',
  });

  // Run all migrations in order
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const migrationsDir = join(__dirname, '../../../../../packages/db/src/migrations');
  const files = [
    '0000_roles.sql',
    '0001_initial_schema.sql',
    '0002_grants.sql',
    '0003_auth_link.sql',
    '0004_rls_fail_loud.sql',
    '0004_staff_invite.sql',
    '0005_auth_lookup_disambiguate.sql',
  ];
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), 'utf-8');
    await pool.query(sql);
  }

  // Seed shops + owner rows
  await pool.query(`
    INSERT INTO shops (id, slug, display_name, status) VALUES
      ('${TENANT_A.id}', 'shop-a', 'Shop A', 'ACTIVE'),
      ('${TENANT_B.id}', 'shop-b', 'Shop B', 'ACTIVE')
    ON CONFLICT DO NOTHING;
    INSERT INTO shop_users (id, shop_id, phone, display_name, role, status, invited_at)
    VALUES ('${OWNER_A_ID}', '${TENANT_A.id}', '+919000000001', 'Owner A', 'shop_admin', 'ACTIVE', now())
    ON CONFLICT DO NOTHING;
    SET app.current_shop_id = '00000000-0000-0000-0000-000000000000';
  `);

  repo = new StaffRepository(pool);
}, 60_000);

afterAll(async () => {
  await pool.end();
  await container.stop();
});

describe('StaffRepository.insertInvited', () => {
  it('inserts a new INVITED row and returns it', async () => {
    const result = await tenantContext.runWith(ctxA(), () =>
      repo.insertInvited({ phone: '+919876543210', displayName: 'Amit', role: 'shop_staff', invitedByUserId: OWNER_A_ID }),
    );
    expect(result.status).toBe('INVITED');
    expect(result.display_name).toBe('Amit');
    expect(result.phone).toBe('+919876543210');
    expect(result.role).toBe('shop_staff');
    expect(result.invited_by_user_id).toBe(OWNER_A_ID);
    expect(result.invited_at).toBeTruthy();
  });

  it('throws ConflictException for duplicate ACTIVE phone', async () => {
    await pool.query(`
      INSERT INTO shop_users (id, shop_id, phone, display_name, role, status, invited_at)
      VALUES (gen_random_uuid(), '${TENANT_A.id}', '+919111111111', 'Active Staff', 'shop_staff', 'ACTIVE', now())
    `);
    await expect(
      tenantContext.runWith(ctxA(), () =>
        repo.insertInvited({ phone: '+919111111111', displayName: 'X', role: 'shop_staff', invitedByUserId: OWNER_A_ID }),
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining('already_exists') });
  });

  it('throws ConflictException for SUSPENDED phone', async () => {
    await pool.query(`
      INSERT INTO shop_users (id, shop_id, phone, display_name, role, status, invited_at)
      VALUES (gen_random_uuid(), '${TENANT_A.id}', '+919222222222', 'Suspended', 'shop_staff', 'SUSPENDED', now())
    `);
    await expect(
      tenantContext.runWith(ctxA(), () =>
        repo.insertInvited({ phone: '+919222222222', displayName: 'X', role: 'shop_staff', invitedByUserId: OWNER_A_ID }),
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining('already_exists') });
  });

  it('throws ConflictException for REVOKED phone', async () => {
    await pool.query(`
      INSERT INTO shop_users (id, shop_id, phone, display_name, role, status, invited_at)
      VALUES (gen_random_uuid(), '${TENANT_A.id}', '+919333333333', 'Revoked', 'shop_staff', 'REVOKED', now())
    `);
    await expect(
      tenantContext.runWith(ctxA(), () =>
        repo.insertInvited({ phone: '+919333333333', displayName: 'X', role: 'shop_staff', invitedByUserId: OWNER_A_ID }),
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining('already_exists') });
  });
});

describe('StaffRepository.refreshInvited', () => {
  it('updates invited_at + invited_by for an INVITED row', async () => {
    const seedRes = await pool.query<{ id: string }>(
      `INSERT INTO shop_users (id, shop_id, phone, display_name, role, status, invited_at)
       VALUES (gen_random_uuid(), '${TENANT_A.id}', '+919444444444', 'Re-invite Me', 'shop_staff', 'INVITED', now() - INTERVAL '1 hour')
       RETURNING id`,
    );
    const existingId = seedRes.rows[0]!.id;

    const result = await tenantContext.runWith(ctxA(), () =>
      repo.refreshInvited({ existingId, invitedByUserId: OWNER_A_ID }),
    );
    expect(result.id).toBe(existingId);
    expect(new Date(result.invited_at).getTime()).toBeGreaterThan(Date.now() - 5000);
  });
});

describe('StaffRepository.findByPhone', () => {
  it('returns null for unknown phone', async () => {
    const result = await tenantContext.runWith(ctxA(), () =>
      repo.findByPhone('+910000000000'),
    );
    expect(result).toBeNull();
  });

  it('does not return rows from another tenant', async () => {
    const ctxB: AuthenticatedTenantContext = {
      shopId: TENANT_B.id, tenant: TENANT_B, authenticated: true, userId: 'dddddddd-dddd-dddd-dddd-dddddddddddd', role: 'shop_admin',
    };
    const result = await tenantContext.runWith(ctxB, () =>
      repo.findByPhone('+919876543210'),
    );
    expect(result).toBeNull();
  });
});

describe('StaffRepository.findAllByShop', () => {
  it('returns masked phone_last4 only', async () => {
    const rows = await tenantContext.runWith(ctxA(), () => repo.findAllByShop());
    for (const r of rows) {
      expect(r.phone_last4).toHaveLength(4);
      expect((r as unknown as Record<string, unknown>)['phone']).toBeUndefined();
    }
  });
});
