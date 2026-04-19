// apps/api/test/_auth-test-setup.ts
import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, Injectable } from '@nestjs/common';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';
import { TenantInterceptor, type TenantLookup, type Tenant } from '@goldsmith/tenant-context';
import { HttpTenantResolver } from '../src/tenant-resolver';
import { AppModule } from '../src/app.module';
import { startFirebaseAuthEmulator, stopFirebaseAuthEmulator } from '@goldsmith/testing-tenant-isolation/fixtures/firebase-emulator';

/** Real tenant lookup backed by the test Postgres pool — replaces NoopTenantLookup in integration tests. */
@Injectable()
class TestTenantLookup implements TenantLookup {
  constructor(private readonly pool: Pool) {}
  async byId(id: string): Promise<Tenant | undefined> {
    const res = await this.pool.query<{ id: string; slug: string; display_name: string; status: string; config: unknown }>(
      `SELECT id, slug, display_name, status, config FROM shops WHERE id = $1`,
      [id],
    );
    if (res.rows.length === 0) return undefined;
    return res.rows[0] as Tenant;
  }
}

export interface AuthTestHarness {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  app: INestApplication;
  testingModule: TestingModule;
  projectId: string;
  emulatorPort: number;
}

export async function setupAuthTestHarness(): Promise<AuthTestHarness> {
  const projectId = 'goldsmith-test';
  const emulatorPort = 9099;
  await startFirebaseAuthEmulator({ port: emulatorPort, projectId });
  const container = await new PostgreSqlContainer('postgres:15.6').start();
  const pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
  process.env['DATABASE_URL'] = container.getConnectionUri();
  const tenantLookup = new TestTenantLookup(pool);
  const testingModule = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider('PG_POOL').useValue(pool)
    // Override TenantInterceptor with one backed by the real test DB so /auth/me can resolve tenants.
    .overrideProvider(TenantInterceptor)
    .useFactory({
      factory: (resolver: HttpTenantResolver) => new TenantInterceptor(resolver, tenantLookup),
      inject: [HttpTenantResolver],
    })
    .compile();
  const app = testingModule.createNestApplication();
  await app.init();
  return { container, pool, app, testingModule, projectId, emulatorPort };
}

export async function teardownAuthTestHarness(h: AuthTestHarness): Promise<void> {
  await h.app?.close();
  await h.pool?.end();
  await h.container?.stop();
  await stopFirebaseAuthEmulator();
}

export async function createFirebaseUserViaEmulator(opts: { projectId: string; port: number; phone: string; uid?: string }): Promise<{ uid: string; idToken: string }> {
  // Use the Admin SDK's createUser + custom token flow. The emulator honours it.
  const admin = (await import('firebase-admin')).default;
  const appName = `test-${Date.now()}`;
  const existing = admin.apps.find(a => a?.name === appName);
  const app = existing ?? admin.initializeApp({ projectId: opts.projectId }, appName);
  try {
    let user;
    try {
      user = await admin.auth(app).createUser({ uid: opts.uid, phoneNumber: opts.phone });
    } catch {
      user = await admin.auth(app).getUserByPhoneNumber(opts.phone);
    }
    // Generate a custom token, exchange it for an ID token via emulator REST endpoint.
    const customToken = await admin.auth(app).createCustomToken(user.uid);
    const res = await fetch(`http://127.0.0.1:${opts.port}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    });
    if (!res.ok) throw new Error(`emulator signInWithCustomToken failed: ${res.status} ${await res.text()}`);
    const body = await res.json() as { idToken: string };
    return { uid: user.uid, idToken: body.idToken };
  } finally {
    await app.delete().catch(() => undefined);
  }
}
