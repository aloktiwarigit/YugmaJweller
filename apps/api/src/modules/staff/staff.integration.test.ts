import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Pool } from 'pg';
import { AppModule } from '../../app.module';

let app: INestApplication;
let container: StartedTestContainer;
let ownerToken: string;

// NOTE: Requires Firebase Auth emulator on localhost:9099
// Start: firebase emulators:start --only auth

beforeAll(async () => {
  container = await new GenericContainer('postgres:15-alpine')
    .withEnvironment({ POSTGRES_DB: 'goldsmith_test', POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'postgres' })
    .withExposedPorts(5432)
    .start();

  process.env['DATABASE_URL'] = `postgres://postgres:postgres@${container.getHost()}:${container.getMappedPort(5432)}/goldsmith_test`;
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = 'localhost:9099';
  process.env['FIREBASE_PROJECT_ID'] = 'goldsmith-dev';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  await app.init();

  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const migrationsDir = join(__dirname, '../../../../../packages/db/src/migrations');
  // Adjust file list to match actual migration files in packages/db/src/migrations/
  const { readdirSync } = await import('fs');
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    await pool.query(readFileSync(join(migrationsDir, f), 'utf-8'));
  }

  const shopId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  await pool.query(`
    INSERT INTO shops (id, slug, display_name, status, config)
    VALUES ('${shopId}', 'anchor-dev', 'Rajesh Jewellers', 'ACTIVE', '{}')
    ON CONFLICT DO NOTHING;
  `);

  const emulatorHost = process.env['FIREBASE_AUTH_EMULATOR_HOST']!;
  const projectId = process.env['FIREBASE_PROJECT_ID']!;

  const signIn = async (phone: string): Promise<string> => {
    const sendRes = await fetch(
      `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=fake-api-key`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: phone, recaptchaToken: 'ignored' }) },
    );
    const { sessionInfo } = await sendRes.json() as { sessionInfo: string };

    const otpRes = await fetch(`http://${emulatorHost}/emulator/v1/projects/${projectId}/verificationCodes`);
    const { verificationCodes } = await otpRes.json() as { verificationCodes: Array<{ phoneNumber: string; code: string }> };
    const code = verificationCodes.find(v => v.phoneNumber === phone)?.code ?? '000000';

    const verifyRes = await fetch(
      `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=fake-api-key`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionInfo, code }) },
    );
    const { idToken } = await verifyRes.json() as { idToken: string };
    return idToken;
  };

  await pool.query(`
    INSERT INTO shop_users (id, shop_id, phone, display_name, role, status, invited_at, activated_at)
    VALUES (gen_random_uuid(), '${shopId}', '+919876599999', 'Active Staff', 'shop_staff', 'ACTIVE', now(), now())
    ON CONFLICT DO NOTHING;
  `);

  const rawOwnerToken = await signIn('+15555550010');
  await pool.query(`
    INSERT INTO shop_users (id, shop_id, phone, display_name, role, status, invited_at)
    VALUES (gen_random_uuid(), '${shopId}', '+15555550010', 'Owner', 'shop_admin', 'INVITED', now())
    ON CONFLICT DO NOTHING;
  `);
  await request(app.getHttpServer())
    .post('/api/v1/auth/session')
    .set('Authorization', `Bearer ${rawOwnerToken}`)
    .expect(200);
  ownerToken = rawOwnerToken;

  await pool.end();
}, 120_000);

afterAll(async () => {
  await app.close();
  await container.stop();
});

describe('POST /api/v1/staff', () => {
  it('201: creates INVITED staff row and returns share text', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ phone: '+919876500001', display_name: 'Amit', role: 'shop_staff' })
      .expect(201);

    expect(res.body.staff.status).toBe('INVITED');
    expect(res.body.staff.display_name).toBe('Amit');
    expect(res.body.share.text).toContain('Amit');
    expect(res.body.share.text).not.toContain('+919876500001');
  });

  it('400: rejects shop_admin role', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ phone: '+919876500002', display_name: 'X', role: 'shop_admin' })
      .expect(400);
  });

  it('400: rejects missing display_name', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff')
      .send({ phone: '+919876500003', role: 'shop_staff' })
      .expect(400);
  });

  it('409: duplicate ACTIVE phone returns 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ phone: '+919876599999', display_name: 'Already Active', role: 'shop_staff' })
      .expect(409);
  });

  it('201: re-invite of INVITED phone returns 201', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ phone: '+919876500005', display_name: 'Reinvite Me', role: 'shop_staff' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ phone: '+919876500005', display_name: 'Reinvite Me', role: 'shop_staff' })
      .expect(201);
    expect(res.body.staff.status).toBe('INVITED');
  });

  it('401: no token returns 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/staff')
      .send({ phone: '+919876500004', display_name: 'X', role: 'shop_staff' })
      .expect(401);
  });
});

describe('GET /api/v1/staff', () => {
  it('200: returns staff list with phone_last4 only', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/staff')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Array.isArray(res.body.staff)).toBe(true);
    for (const s of res.body.staff as Array<Record<string, unknown>>) {
      expect(typeof s['phone_last4']).toBe('string');
      expect(s['phone']).toBeUndefined();
    }
  });
});
