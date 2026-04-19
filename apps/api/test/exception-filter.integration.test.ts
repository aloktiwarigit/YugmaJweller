import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { Controller, Get, HttpException, HttpStatus, Module } from '@nestjs/common';
import { APP_FILTER, Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

@Controller('/fixture')
class FixtureController {
  @Get('/http')
  throwHttp() { throw new HttpException({ code: 'test.http_error', extra: 'context' }, HttpStatus.BAD_REQUEST); }

  @Get('/native')
  throwNative(): never { throw new TypeError('phone=+919000000001 should not leak'); }

  @Get('/pg-unique')
  throwPgUnique() { const e = new Error('duplicate key value violates unique constraint "shops_slug_key"'); (e as Error & {code?:string}).code = '23505'; throw e; }

  @Get('/pg-fk')
  throwPgFk() { const e = new Error('foreign key violation'); (e as Error & {code?:string}).code = '23503'; throw e; }

  @Get('/pg-check')
  throwPgCheck() { const e = new Error('check constraint violation'); (e as Error & {code?:string}).code = '23514'; throw e; }
}

@Module({ controllers: [FixtureController], providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }, Reflector] })
class FixtureModule {}

describe('GlobalExceptionFilter hardening (E2-S1 deferral #2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [FixtureModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app?.close(); });

  it('HttpException → RFC 7807 problem+json with code + status + requestId', async () => {
    const res = await request(app.getHttpServer()).get('/fixture/http');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('test.http_error');
    expect(res.body.status).toBe(400);
    expect(res.body.requestId).toBeTruthy();
    expect(res.body.type).toBe('about:blank');
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('non-HttpException (TypeError) → 500 internal_error, no message leak', async () => {
    const res = await request(app.getHttpServer()).get('/fixture/native');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('internal_error');
    // Critical: must NOT leak the phone value from the error message
    expect(JSON.stringify(res.body)).not.toContain('+919000000001');
    expect(JSON.stringify(res.body)).not.toContain('should not leak');
    expect(res.body.requestId).toBeTruthy();
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('pg 23505 unique_violation → 409 conflict, no SQL in body', async () => {
    const res = await request(app.getHttpServer()).get('/fixture/pg-unique');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('conflict');
    expect(JSON.stringify(res.body)).not.toMatch(/shops_slug_key|duplicate key/i);
  });

  it('pg 23503 foreign_key_violation → 422, no SQL in body', async () => {
    const res = await request(app.getHttpServer()).get('/fixture/pg-fk');
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('foreign_key_violation');
    expect(JSON.stringify(res.body)).not.toMatch(/foreign key violation/i);
  });

  it('pg 23514 check_violation → 422, no SQL in body', async () => {
    const res = await request(app.getHttpServer()).get('/fixture/pg-check');
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('check_violation');
    expect(JSON.stringify(res.body)).not.toMatch(/check constraint/i);
  });

  it('existing x-request-id header is propagated (not overwritten)', async () => {
    const res = await request(app.getHttpServer()).get('/fixture/http').set('x-request-id', 'upstream-req-123');
    expect(res.headers['x-request-id']).toBe('upstream-req-123');
    expect(res.body.requestId).toBe('upstream-req-123');
  });
});
