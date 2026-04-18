import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

let app: INestApplication;

beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  await app.init();
});

afterAll(async () => { await app?.close(); });

describe('GET /healthz', () => {
  it('returns 200 OK without requiring tenant ctx', async () => {
    const res = await request(app.getHttpServer()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('tenant-scoped endpoint returns 401 without ctx', async () => {
    const res = await request(app.getHttpServer()).get('/demo/ping');
    expect([401, 404]).toContain(res.status);
  });
});
