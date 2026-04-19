// apps/api/test/auth-missing-phone.integration.test.ts
// Regression: FirebaseJwtStrategy returning undefined phone_number must yield 401, not 500.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { createPool, runMigrations } from '@goldsmith/db';
import { AppModule } from '../src/app.module';
import { FirebaseJwtStrategy } from '../src/modules/auth/firebase-jwt.strategy';

describe('POST /api/v1/auth/session — missing phone_number claim → 401', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let app: INestApplication;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
    process.env['DATABASE_URL'] = container.getConnectionUri();
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
    process.env['FIREBASE_PROJECT_ID'] = 'goldsmith-test';

    // Override FirebaseJwtStrategy to synthesize a token WITHOUT phone_number (email/anonymous path)
    const mockStrategy = {
      validate: async () => {
        // Returns claims without phone_number — simulating email-only or anonymous Firebase user
        return { uid: 'email-user-uid', phone_number: undefined };
      },
    };

    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider('PG_POOL').useValue(pool)
      .overrideProvider(FirebaseJwtStrategy).useValue(mockStrategy)
      .compile();
    app = mod.createNestApplication();
    await app.init();
  }, 120_000);

  afterAll(async () => { await app?.close(); await pool?.end(); await container?.stop(); });

  it('token without phone_number returns 401 auth.missing (not 500)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/session')
      .set('Authorization', 'Bearer any-token-here')
      .send();
    // Must be 401, never 500 (PK violation from undefined phone)
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('auth.missing');
  });
});
