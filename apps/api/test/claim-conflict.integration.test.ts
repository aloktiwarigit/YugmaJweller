import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupAuthTestHarness, teardownAuthTestHarness, createFirebaseUserViaEmulator, type AuthTestHarness } from './_auth-test-setup';

let h: AuthTestHarness;
beforeAll(async () => { h = await setupAuthTestHarness(); }, 180_000);
afterAll(async () => { await teardownAuthTestHarness(h); });

describe('Tenant claim-conflict (E2-S1 deferral #1)', () => {
  it('valid tenant-A token + X-Tenant-Id: tenant-B → 403 tenant.claim_conflict + audit', async () => {
    const shopA = 'aaaa0000-0000-0000-0000-000000000001';
    const shopB = 'bbbb0000-0000-0000-0000-000000000002';
    const phone = '+919000011001';
    await h.pool.query(`INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'cc-a', 'A', 'ACTIVE'),($2, 'cc-b', 'B', 'ACTIVE') ON CONFLICT DO NOTHING`, [shopA, shopB]);
    await h.pool.query(`INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES ($1, $2, 'O', 'shop_admin', 'INVITED') ON CONFLICT DO NOTHING`, [shopA, phone]);
    const { uid, idToken } = await createFirebaseUserViaEmulator({ projectId: h.projectId, port: h.emulatorPort, phone });
    await request(h.app.getHttpServer()).post('/api/v1/auth/session').set('Authorization', `Bearer ${idToken}`).expect(200);

    // Refresh token to pick up custom claims (shop_id=shopA)
    const admin = (await import('firebase-admin')).default;
    const app = admin.app(admin.apps[0]!.name);
    const custom = await admin.auth(app).createCustomToken(uid);
    const refresh = await fetch(`http://127.0.0.1:${h.emulatorPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }),
    });
    const { idToken: token2 } = await refresh.json() as { idToken: string };

    // Now hit /auth/me with the token (carrying shop_id=shopA) but X-Tenant-Id: shopB → claim conflict.
    const res = await request(h.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token2}`)
      .set('X-Tenant-Id', shopB);
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.title).toMatch(/tenant\.claim_conflict/);
    const audit = await h.pool.query(`SELECT action FROM platform_audit_events WHERE action = 'TENANT_CLAIM_CONFLICT'`);
    expect(audit.rowCount).toBeGreaterThan(0);
  });

  it('valid token with matching X-Tenant-Id succeeds', async () => {
    const shopId = 'cccc0000-0000-0000-0000-000000000003';
    const phone = '+919000011002';
    await h.pool.query(`INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'cc-ok', 'OK', 'ACTIVE') ON CONFLICT DO NOTHING`, [shopId]);
    await h.pool.query(`INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES ($1, $2, 'O', 'shop_admin', 'INVITED') ON CONFLICT DO NOTHING`, [shopId, phone]);
    const { uid, idToken } = await createFirebaseUserViaEmulator({ projectId: h.projectId, port: h.emulatorPort, phone });
    await request(h.app.getHttpServer()).post('/api/v1/auth/session').set('Authorization', `Bearer ${idToken}`).expect(200);
    const admin = (await import('firebase-admin')).default;
    const app = admin.app(admin.apps[0]!.name);
    const custom = await admin.auth(app).createCustomToken(uid);
    const refresh = await fetch(`http://127.0.0.1:${h.emulatorPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }),
    });
    const { idToken: token2 } = await refresh.json() as { idToken: string };
    const res = await request(h.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token2}`)
      .set('X-Tenant-Id', shopId);
    expect(res.status).toBe(200);
  });
});
