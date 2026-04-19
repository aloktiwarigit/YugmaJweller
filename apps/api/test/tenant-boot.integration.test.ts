import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { createPool, runMigrations } from '@goldsmith/db';
import { AppModule } from '../src/app.module';

describe('GET /api/v1/tenant/boot', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let app: INestApplication;
  const SHOP_ID = 'aaaaaaaa-1111-1111-1111-111111111111';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
    process.env['DATABASE_URL'] = container.getConnectionUri();
    // FirebaseAdminProvider needs these env vars to boot (emulator path, no real creds needed).
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
    process.env['FIREBASE_PROJECT_ID'] = 'goldsmith-test';
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status, config)
       VALUES ($1, 'anchor-dev', 'Anchor Dev', 'ACTIVE', $2)`,
      [SHOP_ID, JSON.stringify({ app_name: 'Anchor Dev', default_language: 'hi-IN' })],
    );
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider('PG_POOL').useValue(pool)
      .compile();
    app = mod.createNestApplication();
    await app.init();
  }, 180_000);
  afterAll(async () => { await app?.close(); await pool?.end(); await container?.stop(); });

  it('returns id+display_name+config for ACTIVE shop by slug', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/tenant/boot?slug=anchor-dev');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(SHOP_ID);
    expect(res.body.display_name).toBe('Anchor Dev');
    expect(res.body.config.default_language).toBe('hi-IN');
  });

  it('unknown slug returns 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/tenant/boot?slug=does-not-exist');
    expect(res.status).toBe(404);
  });

  it('SUSPENDED shop returns 404', async () => {
    const SUS_ID = 'bbbbbbbb-2222-2222-2222-222222222222';
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status) VALUES ($1, 'sus', 'Sus', 'SUSPENDED')`,
      [SUS_ID],
    );
    const res = await request(app.getHttpServer()).get('/api/v1/tenant/boot?slug=sus');
    expect(res.status).toBe(404);
  });

  it('no token required (SkipAuth + SkipTenant)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/tenant/boot?slug=anchor-dev');
    expect(res.status).toBe(200);
  });

  it('response has Cache-Control and ETag headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/tenant/boot?slug=anchor-dev');
    expect(res.headers['cache-control']).toMatch(/max-age=86400.*stale-while-revalidate=86400/);
    expect(res.headers['etag']).toBeTruthy();
  });

  it('If-None-Match returns 304', async () => {
    const first = await request(app.getHttpServer()).get('/api/v1/tenant/boot?slug=anchor-dev');
    const etag = first.headers['etag'];
    const res = await request(app.getHttpServer()).get('/api/v1/tenant/boot?slug=anchor-dev').set('If-None-Match', etag);
    expect(res.status).toBe(304);
  });

  it('successful boot emits TENANT_BOOT platform audit event', async () => {
    await pool.query('DELETE FROM platform_audit_events WHERE action = $1', ['TENANT_BOOT']);
    await request(app.getHttpServer()).get('/api/v1/tenant/boot?slug=anchor-dev');
    // Allow the fire-and-forget audit to settle
    await new Promise((r) => setTimeout(r, 100));
    const r = await pool.query(
      `SELECT action, metadata FROM platform_audit_events WHERE action = 'TENANT_BOOT' LIMIT 1`,
    );
    expect(r.rowCount).toBeGreaterThan(0);
    expect((r.rows[0].metadata as { slug?: string }).slug).toBe('anchor-dev');
  });

  it('slug array param returns 404 (typeof guard)', async () => {
    // Express parses ?slug=a&slug=b as an array — guard must catch this
    const res = await request(app.getHttpServer()).get('/api/v1/tenant/boot?slug=anchor-dev&slug=other');
    expect(res.status).toBe(404);
  });
});
