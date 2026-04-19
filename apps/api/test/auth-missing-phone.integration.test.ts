// apps/api/test/auth-missing-phone.integration.test.ts
// Regression: FirebaseJwtStrategy returning undefined phone_number must yield 401, not 500.
// Tests the controller-level guard independently of Passport by injecting req.user directly.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { createPool, runMigrations } from '@goldsmith/db';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthController.session — missing phone_number claim → 401', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
    process.env['DATABASE_URL'] = container.getConnectionUri();
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
    process.env['FIREBASE_PROJECT_ID'] = 'goldsmith-test';
  }, 120_000);

  afterAll(async () => { await pool?.end(); await container?.stop(); });

  it('user without phone_number on req.user throws UnauthorizedException auth.missing', async () => {
    const mockSvc = { session: async () => ({ user: {}, tenant: {}, requires_token_refresh: false }) };
    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockSvc }],
    }).compile();
    const controller = mod.get(AuthController);

    // Simulate request with uid but no phone_number (email/anonymous Firebase user)
    const fakeReq = { user: { uid: 'email-user-uid', phone_number: undefined }, headers: {} } as never;

    await expect(controller.session(fakeReq, '1.2.3.4')).rejects.toMatchObject({
      response: { code: 'auth.missing' },
    });
  });

  it('user with no uid on req.user throws UnauthorizedException auth.missing', async () => {
    const mockSvc = { session: async () => ({ user: {}, tenant: {}, requires_token_refresh: false }) };
    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockSvc }],
    }).compile();
    const controller = mod.get(AuthController);

    const fakeReq = { user: { uid: undefined, phone_number: '+919000000001' }, headers: {} } as never;

    await expect(controller.session(fakeReq, '1.2.3.4')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('missing user entirely on req throws UnauthorizedException auth.missing', async () => {
    const mockSvc = { session: async () => ({ user: {}, tenant: {}, requires_token_refresh: false }) };
    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockSvc }],
    }).compile();
    const controller = mod.get(AuthController);

    const fakeReq = { user: undefined, headers: {} } as never;

    await expect(controller.session(fakeReq, '1.2.3.4')).rejects.toMatchObject({
      response: { code: 'auth.missing' },
    });
  });
});
