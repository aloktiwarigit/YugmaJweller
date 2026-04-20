// apps/api/test/auth-staff.integration.spec.ts
//
// Integration tests for the 4 new auth endpoints:
//   POST   /api/v1/auth/invite
//   GET    /api/v1/auth/users
//   GET    /api/v1/auth/roles/:role/permissions
//   PUT    /api/v1/auth/roles/:role/permissions
//
// Test class: B — endpoints touch auth + DB but not Class-A surfaces (no
// money/weight columns, no RLS migrations). Uses the same harness as the
// existing auth-session tests.
//
// Setup:
//   • PostgreSQL 15.6 testcontainer + migrations (real DB)
//   • Firebase Auth emulator (real JWT verification)
//   • Two shops (SHOP_A, SHOP_B) each with one ACTIVE shop_admin
//   • PermissionsCache mocked with a spy to assert invalidation without Redis

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import {
  setupAuthTestHarness,
  teardownAuthTestHarness,
  createFirebaseUserViaEmulator,
  type AuthTestHarness,
} from './_auth-test-setup';
import { PermissionsRepository } from '../src/modules/auth/permissions.repository';
import { PermissionsCache } from '@goldsmith/tenant-config';

// ─── Fixture UUIDs (non-overlapping with other test files) ───────────────────

const SHOP_A_ID = 'cc000001-0000-0000-0000-000000000001';
const SHOP_B_ID = 'cc000002-0000-0000-0000-000000000002';

const ADMIN_A_PHONE = '+919100000001';
const ADMIN_B_PHONE = '+919100000002';

// ─── Shared harness ───────────────────────────────────────────────────────────

let h: AuthTestHarness;

/** Tokens for shop_admin of each shop — populated in beforeAll. */
let tokenA: string;  // ID token with shop_admin custom claims for SHOP_A
let tokenB: string;  // ID token with shop_admin custom claims for SHOP_B

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Seed a shop + shop_admin user, call /auth/session to provision Firebase
 * custom claims, then refresh the ID token so the new claims are embedded.
 * Returns the refreshed token and the DB user_id.
 */
async function seedShopAndGetToken(
  shopId: string,
  slug: string,
  phone: string,
): Promise<{ token: string; userId: string }> {
  // 1. Seed shop
  await h.pool.query(
    `INSERT INTO shops (id, slug, display_name, status)
     VALUES ($1, $2, $3, 'ACTIVE') ON CONFLICT DO NOTHING`,
    [shopId, slug, `Shop ${slug}`],
  );

  // 2. Seed admin user (INVITED — /session activates + links firebase_uid)
  const userInsert = await h.pool.query<{ id: string }>(
    `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
     VALUES ($1, $2, 'Admin', 'shop_admin', 'INVITED')
     ON CONFLICT (shop_id, phone) DO UPDATE SET status = 'INVITED'
     RETURNING id`,
    [shopId, phone],
  );
  const userId = userInsert.rows[0].id;

  // 3. Create Firebase user + get initial ID token (no custom claims yet)
  const { uid, idToken: initialToken } = await createFirebaseUserViaEmulator({
    projectId: h.projectId,
    port: h.emulatorPort,
    phone,
  });

  // 4. Call /session — this calls setCustomUserClaims (shop_id, role, user_id)
  await request(h.app.getHttpServer())
    .post('/api/v1/auth/session')
    .set('Authorization', `Bearer ${initialToken}`)
    .expect(200);

  // 5. Refresh token so custom claims are embedded
  const admin = (await import('firebase-admin')).default;
  const app = admin.app(admin.apps[0]!.name);
  const newCustomToken = await admin.auth(app).createCustomToken(uid);
  const refreshRes = await fetch(
    `http://127.0.0.1:${h.emulatorPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: newCustomToken, returnSecureToken: true }),
    },
  );
  if (!refreshRes.ok) {
    throw new Error(`Token refresh failed: ${refreshRes.status} ${await refreshRes.text()}`);
  }
  const { idToken: refreshedToken } = await refreshRes.json() as { idToken: string };

  return { token: refreshedToken, userId };
}

// ─── Global beforeAll / afterAll ──────────────────────────────────────────────

beforeAll(async () => {
  h = await setupAuthTestHarness();

  // Seed permissions defaults for SHOP_A (so GET /roles/:role/permissions has rows)
  // We'll do this after the harness is up — use the real PermissionsRepository.
  const permRepo = h.testingModule.get(PermissionsRepository);

  // Provision SHOP_A and SHOP_B shops first (needed before seedDefaults)
  await h.pool.query(
    `INSERT INTO shops (id, slug, display_name, status)
     VALUES ($1, $2, $3, 'ACTIVE'), ($4, $5, $6, 'ACTIVE')
     ON CONFLICT DO NOTHING`,
    [SHOP_A_ID, 'staff-test-a', 'Shop A', SHOP_B_ID, 'staff-test-b', 'Shop B'],
  );

  await permRepo.seedDefaults(SHOP_A_ID);
  await permRepo.seedDefaults(SHOP_B_ID);

  // Now get authenticated tokens (this also re-upserts the shops, idempotent)
  ({ token: tokenA } = await seedShopAndGetToken(SHOP_A_ID, 'staff-test-a', ADMIN_A_PHONE));
  ({ token: tokenB } = await seedShopAndGetToken(SHOP_B_ID, 'staff-test-b', ADMIN_B_PHONE));
}, 240_000);

afterAll(async () => {
  await teardownAuthTestHarness(h);
});

// ─── 1. POST /api/v1/auth/invite ─────────────────────────────────────────────

describe('POST /api/v1/auth/invite', () => {
  it('invites a new staff member and returns userId', async () => {
    const res = await request(h.app.getHttpServer())
      .post('/api/v1/auth/invite')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID)
      .send({ phone: '+919111110001', role: 'shop_staff', display_name: 'New Staff' });

    expect(res.status).toBe(201);
    expect(typeof res.body.userId).toBe('string');
    expect(res.body.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // Verify the DB row exists with status INVITED
    const row = await h.pool.query(
      `SELECT status, role FROM shop_users WHERE id = $1`,
      [res.body.userId],
    );
    expect(row.rows[0].status).toBe('INVITED');
    expect(row.rows[0].role).toBe('shop_staff');
  });

  it('returns 409 when same phone already has INVITED/ACTIVE status in this shop', async () => {
    const phone = '+919111110002';

    // First invite — must succeed
    const first = await request(h.app.getHttpServer())
      .post('/api/v1/auth/invite')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID)
      .send({ phone, role: 'shop_manager', display_name: 'Dup Staff' });
    expect(first.status).toBe(201);

    // Second invite — same phone → 409
    const second = await request(h.app.getHttpServer())
      .post('/api/v1/auth/invite')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID)
      .send({ phone, role: 'shop_staff', display_name: 'Dup Staff Again' });
    expect(second.status).toBe(409);
    expect(second.body.errorCode ?? second.body.message ?? '').toMatch(/auth\.invite_conflict|conflict/i);
  });

  it('does not leak phone number in audit log metadata', async () => {
    const phone = '+919111110003';

    const res = await request(h.app.getHttpServer())
      .post('/api/v1/auth/invite')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID)
      .send({ phone, role: 'shop_staff', display_name: 'Audit Check' });
    expect(res.status).toBe(201);

    // Allow the fire-and-forget audit to settle
    await new Promise((resolve) => setTimeout(resolve, 150));

    // The STAFF_INVITED audit row should contain display_name and role in metadata,
    // but must NOT contain the raw phone number (PII should not appear in audit metadata).
    const auditRows = await h.pool.query<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM audit_events
       WHERE action = 'STAFF_INVITED' AND subject_id = $1`,
      [res.body.userId],
    );
    expect(auditRows.rowCount).toBeGreaterThan(0);
    const meta = auditRows.rows[0].metadata;
    const metaStr = JSON.stringify(meta);
    // phone should NOT be in metadata
    expect(metaStr).not.toContain(phone);
    // role and display_name should be present
    expect(metaStr).toContain('shop_staff');
    expect(metaStr).toContain('Audit Check');
  });
});

// ─── 2. GET + PUT /api/v1/auth/roles/:role/permissions ───────────────────────

describe('GET /auth/roles/:role/permissions + PUT /auth/roles/:role/permissions', () => {
  it('GET returns seeded defaults for shop_manager', async () => {
    const res = await request(h.app.getHttpServer())
      .get('/api/v1/auth/roles/shop_manager/permissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID);

    expect(res.status).toBe(200);
    // seedDefaults sets billing.create=true, billing.void=false, reports.view=true
    expect(res.body['billing.create']).toBe(true);
    expect(res.body['billing.void']).toBe(false);
    expect(res.body['reports.view']).toBe(true);
    expect(res.body['analytics.view']).toBe(true);
    expect(res.body['settings.edit']).toBe(false);
  });

  it('PUT updates a permission and GET reflects the change', async () => {
    // Toggle settings.edit from false → true for shop_manager
    const putRes = await request(h.app.getHttpServer())
      .put('/api/v1/auth/roles/shop_manager/permissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID)
      .send({ permission_key: 'settings.edit', is_enabled: true });

    expect(putRes.status).toBe(200);

    const getRes = await request(h.app.getHttpServer())
      .get('/api/v1/auth/roles/shop_manager/permissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID);

    expect(getRes.status).toBe(200);
    expect(getRes.body['settings.edit']).toBe(true);

    // Restore for test isolation
    await request(h.app.getHttpServer())
      .put('/api/v1/auth/roles/shop_manager/permissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID)
      .send({ permission_key: 'settings.edit', is_enabled: false });
  });

  it('PUT invalidates the Redis cache entry', async () => {
    // Spy on the PermissionsCache.invalidate method bound to the app's instance
    const cache = h.testingModule.get(PermissionsCache);
    const invalidateSpy = vi.spyOn(cache, 'invalidate');

    const putRes = await request(h.app.getHttpServer())
      .put('/api/v1/auth/roles/shop_manager/permissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID)
      .send({ permission_key: 'inventory.edit', is_enabled: true });

    expect(putRes.status).toBe(200);
    expect(invalidateSpy).toHaveBeenCalledWith(SHOP_A_ID, 'shop_manager');

    // Restore
    invalidateSpy.mockRestore();
    await request(h.app.getHttpServer())
      .put('/api/v1/auth/roles/shop_manager/permissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID)
      .send({ permission_key: 'inventory.edit', is_enabled: false });
  });
});

// ─── 3. Tenant isolation ──────────────────────────────────────────────────────

describe('Tenant isolation', () => {
  it('shop A cannot read permissions seeded for shop B', async () => {
    // Seed a SHOP_B-only permission that SHOP_A's admin should never see
    await h.pool.query(
      `INSERT INTO role_permissions (shop_id, role, permission_key, is_enabled)
       VALUES ($1, 'shop_manager', 'billing.void', true)
       ON CONFLICT (shop_id, role, permission_key) DO UPDATE SET is_enabled = true`,
      [SHOP_B_ID],
    );

    // SHOP_A's token queries SHOP_A — should see SHOP_A defaults, not SHOP_B
    const res = await request(h.app.getHttpServer())
      .get('/api/v1/auth/roles/shop_manager/permissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID);

    expect(res.status).toBe(200);
    // SHOP_A seeded billing.void = false; should not see SHOP_B's true override
    expect(res.body['billing.void']).toBe(false);

    // Confirm SHOP_B admin sees its own value (true)
    const resB = await request(h.app.getHttpServer())
      .get('/api/v1/auth/roles/shop_manager/permissions')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Tenant-Id', SHOP_B_ID);

    expect(resB.status).toBe(200);
    expect(resB.body['billing.void']).toBe(true);
  });

  it('invite in shop A is not visible in GET /auth/users for shop B', async () => {
    const exclusivePhone = '+919111110099';

    // Invite a user in SHOP_A only
    const inviteRes = await request(h.app.getHttpServer())
      .post('/api/v1/auth/invite')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID)
      .send({ phone: exclusivePhone, role: 'shop_staff', display_name: 'Exclusive A' });
    expect(inviteRes.status).toBe(201);

    // SHOP_B admin must NOT see that user
    const resB = await request(h.app.getHttpServer())
      .get('/api/v1/auth/users')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Tenant-Id', SHOP_B_ID);
    expect(resB.status).toBe(200);
    const phones = (resB.body as Array<{ phone: string }>).map((u) => u.phone);
    expect(phones).not.toContain(exclusivePhone);

    // SHOP_A admin SHOULD see that user
    const resA = await request(h.app.getHttpServer())
      .get('/api/v1/auth/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Tenant-Id', SHOP_A_ID);
    expect(resA.status).toBe(200);
    const phonesA = (resA.body as Array<{ phone: string }>).map((u) => u.phone);
    expect(phonesA).toContain(exclusivePhone);
  });
});
