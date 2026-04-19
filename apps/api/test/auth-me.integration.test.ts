import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupAuthTestHarness, teardownAuthTestHarness, createFirebaseUserViaEmulator, type AuthTestHarness } from './_auth-test-setup';

let h: AuthTestHarness;
beforeAll(async () => { h = await setupAuthTestHarness(); }, 180_000);
afterAll(async () => { await teardownAuthTestHarness(h); });

describe('GET /api/v1/auth/me', () => {
  it('returns user + tenant with authenticated context', async () => {
    const shopId = '66666666-6666-6666-6666-666666666666';
    const phone = '+919000010001';
    await h.pool.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'me-shop', 'Me', 'ACTIVE') ON CONFLICT DO NOTHING`,
      [shopId],
    );
    await h.pool.query(
      `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
       VALUES ($1, $2, 'O', 'shop_admin', 'INVITED') ON CONFLICT (shop_id, phone) DO NOTHING`,
      [shopId, phone],
    );
    const { uid, idToken } = await createFirebaseUserViaEmulator({ projectId: h.projectId, port: h.emulatorPort, phone });

    // First /auth/session call provisions + sets custom claims + returns requires_token_refresh.
    await request(h.app.getHttpServer()).post('/api/v1/auth/session').set('Authorization', `Bearer ${idToken}`).expect(200);

    // Force token refresh so new custom claims land in the ID token.
    const admin = (await import('firebase-admin')).default;
    const app = admin.app(admin.apps[0]!.name);
    const newCustomToken = await admin.auth(app).createCustomToken(uid);
    const refreshRes = await fetch(`http://127.0.0.1:${h.emulatorPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: newCustomToken, returnSecureToken: true }),
    });
    const { idToken: idToken2 } = await refreshRes.json() as { idToken: string };

    // With claims present, /auth/me returns authenticated ctx.
    const res = await request(h.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${idToken2}`)
      .set('X-Tenant-Id', shopId); // header acts as fallback since fromJwt is still noop in Task 8
    expect(res.status).toBe(200);
    expect(res.body.tenant.id).toBe(shopId);
    expect(res.body.user.role).toBe('shop_admin');
  });

  it('no token → 401', async () => {
    const res = await request(h.app.getHttpServer()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
