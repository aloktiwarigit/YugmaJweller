import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { createPool, runMigrations } from '@goldsmith/db';
import { AppModule } from '../src/app.module';
import { startFirebaseAuthEmulator, stopFirebaseAuthEmulator, provisionFixtures, fixtureRegistry } from '@goldsmith/testing-tenant-isolation';
import { walkTenantScopedEndpoints, type SeededTenantToken } from '@goldsmith/testing-tenant-isolation';

describe('endpoint-walker — real tenant-scoped assertions (E2-S1 deferral #4)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let app: INestApplication;
  const projectId = 'goldsmith-walker-test';
  const emulatorPort = 9099;
  const seeded: SeededTenantToken[] = [];

  beforeAll(async () => {
    await startFirebaseAuthEmulator({ port: emulatorPort, projectId });
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
    process.env['DATABASE_URL'] = container.getConnectionUri();
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] = `127.0.0.1:${emulatorPort}`;
    process.env['FIREBASE_PROJECT_ID'] = projectId;
    await provisionFixtures(pool);

    const admin = (await import('firebase-admin')).default;
    const fbApp = admin.initializeApp({ projectId }, `walker-${Date.now()}`);

    // For each fixture, create the matching Firebase user and exchange a custom token for an ID token.
    for (const fixture of fixtureRegistry.list()) {
      // Fetch the phone for this fixture's shop_admin row (first shop_user seeded).
      const r = await pool.query(
        `SELECT phone, firebase_uid FROM shop_users WHERE shop_id = $1 ORDER BY created_at LIMIT 1`,
        [fixture.id],
      );
      const phone = r.rows[0].phone as string;
      const expectedUid = r.rows[0].firebase_uid as string;
      let user;
      try {
        user = await admin.auth(fbApp).createUser({ uid: expectedUid, phoneNumber: phone });
      } catch {
        user = await admin.auth(fbApp).getUserByPhoneNumber(phone);
      }

      // Set custom claims so the ID token carries shop_id + role
      await admin.auth(fbApp).setCustomUserClaims(user.uid, { shop_id: fixture.id, role: 'shop_admin' });

      const custom = await admin.auth(fbApp).createCustomToken(user.uid);
      const resp = await fetch(`http://127.0.0.1:${emulatorPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: custom, returnSecureToken: true }),
      });
      const { idToken } = await resp.json() as { idToken: string };
      seeded.push({ id: fixture.id, slug: fixture.slug, firebaseUid: user.uid, token: idToken });
    }
    await fbApp.delete().catch(() => undefined);

    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider('PG_POOL').useValue(pool)
      .compile();
    app = mod.createNestApplication();
    await app.init();
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
    await container?.stop();
    await stopFirebaseAuthEmulator();
  });

  it('each tenant token sees only its own /auth/me row', async () => {
    await walkTenantScopedEndpoints(app, { tenants: seeded });
  });

  it('no token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('malformed token → 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-valid-token');
    expect(res.status).toBe(401);
  });

  it('A token + X-Tenant-Id: B → 403 tenant.claim_conflict', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${seeded[0].token}`)
      .set('X-Tenant-Id', seeded[1].id);
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.title).toMatch(/tenant\.claim_conflict/);
  });
});
