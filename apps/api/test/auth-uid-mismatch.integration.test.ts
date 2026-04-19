import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupAuthTestHarness, teardownAuthTestHarness, createFirebaseUserViaEmulator, type AuthTestHarness } from './_auth-test-setup';

let h: AuthTestHarness;
beforeAll(async () => { h = await setupAuthTestHarness(); }, 180_000);
afterAll(async () => { await teardownAuthTestHarness(h); });

describe('UID mismatch guard', () => {
  it('existing firebase_uid differs from token uid → 403 auth.uid_mismatch + platform audit', async () => {
    const shopId = '55555555-5555-5555-5555-555555555555';
    const phone = '+919000009001';
    await h.pool.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'uid-mismatch-shop', 'T', 'ACTIVE') ON CONFLICT DO NOTHING`,
      [shopId],
    );
    await h.pool.query(
      `INSERT INTO shop_users (shop_id, phone, display_name, role, status, firebase_uid)
       VALUES ($1, $2, 'O', 'shop_admin', 'ACTIVE', 'pre-existing-uid')
       ON CONFLICT (shop_id, phone) DO UPDATE SET firebase_uid = 'pre-existing-uid'`,
      [shopId, phone],
    );
    const { idToken } = await createFirebaseUserViaEmulator({ projectId: h.projectId, port: h.emulatorPort, phone });
    const res = await request(h.app.getHttpServer())
      .post('/api/v1/auth/session')
      .set('Authorization', `Bearer ${idToken}`);
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.title).toMatch(/auth\.uid_mismatch/);
    const audit = await h.pool.query(`SELECT action FROM platform_audit_events WHERE action = 'AUTH_UID_MISMATCH'`);
    expect(audit.rowCount).toBeGreaterThan(0);
  });
});
