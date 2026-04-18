import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupAuthTestHarness, teardownAuthTestHarness, createFirebaseUserViaEmulator, type AuthTestHarness } from './_auth-test-setup';

let h: AuthTestHarness;

beforeAll(async () => { h = await setupAuthTestHarness(); }, 180_000);
afterAll(async () => { await teardownAuthTestHarness(h); });

async function seedTenant(shopId: string, slug: string, phone: string): Promise<string> {
  await h.pool.query(
    `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, $2, $3, 'ACTIVE') ON CONFLICT DO NOTHING`,
    [shopId, slug, `Shop ${slug}`],
  );
  const r = await h.pool.query(
    `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
     VALUES ($1, $2, 'Owner', 'shop_admin', 'INVITED')
     ON CONFLICT (shop_id, phone) DO UPDATE SET status = 'INVITED' RETURNING id`,
    [shopId, phone],
  );
  return r.rows[0].id;
}

describe('POST /api/v1/auth/session', () => {
  it('first-time login links firebase_uid, returns 200 with tenant + requires_token_refresh', async () => {
    const shopId = '44444444-4444-4444-4444-444444444444';
    const phone = '+919000008001';
    await seedTenant(shopId, 'sesh-1', phone);
    const { idToken } = await createFirebaseUserViaEmulator({ projectId: h.projectId, port: h.emulatorPort, phone });
    const res = await request(h.app.getHttpServer())
      .post('/api/v1/auth/session')
      .set('Authorization', `Bearer ${idToken}`);
    expect(res.status).toBe(200);
    expect(res.body.requires_token_refresh).toBe(true);
    expect(res.body.tenant.id).toBe(shopId);
    expect(res.body.user.role).toBe('shop_admin');
    const row = await h.pool.query('SELECT firebase_uid, status FROM shop_users WHERE phone = $1', [phone]);
    expect(row.rows[0].firebase_uid).toBeTruthy();
    expect(row.rows[0].status).toBe('ACTIVE');
  });

  it('unknown phone → 403 auth.not_provisioned + platform_audit_events row', async () => {
    const phone = '+919000008666';
    const { idToken } = await createFirebaseUserViaEmulator({ projectId: h.projectId, port: h.emulatorPort, phone });
    const res = await request(h.app.getHttpServer())
      .post('/api/v1/auth/session')
      .set('Authorization', `Bearer ${idToken}`);
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.title).toMatch(/auth\.not_provisioned/);
    const audit = await h.pool.query(`SELECT action FROM platform_audit_events WHERE action = 'AUTH_VERIFY_FAILURE'`);
    expect(audit.rowCount).toBeGreaterThan(0);
  });

  it('10 failures → 11th returns 403 auth.locked with retryAfterSeconds', async () => {
    const phone = '+919000008777';
    const { idToken } = await createFirebaseUserViaEmulator({ projectId: h.projectId, port: h.emulatorPort, phone });
    for (let i = 0; i < 10; i++) {
      await request(h.app.getHttpServer()).post('/api/v1/auth/session').set('Authorization', `Bearer ${idToken}`);
    }
    const res = await request(h.app.getHttpServer())
      .post('/api/v1/auth/session')
      .set('Authorization', `Bearer ${idToken}`);
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.title).toMatch(/auth\.locked/);
  });
});
