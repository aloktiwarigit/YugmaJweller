// LIT-UP-IN-STORY-1.1 — in E2-S1 this walker only exercises /healthz. Story 1.1 will introduce
// tenant-scoped endpoints and extend this walker to probe each with tenant A's ctx and assert
// zero B/C data leakage (Acceptance Criterion #10).

import { Test } from '@nestjs/testing';
import type { INestApplication, Type } from '@nestjs/common';
import request from 'supertest';

export interface WalkResult {
  route: string;
  method: string;
  status: number;
  skipReason?: string;
}

export async function walkHealthz(appModule: Type<unknown>): Promise<WalkResult[]> {
  const module = await Test.createTestingModule({ imports: [appModule] }).compile();
  const app: INestApplication = module.createNestApplication();
  await app.init();
  try {
    const res = await request(app.getHttpServer()).get('/healthz');
    return [{ route: '/healthz', method: 'GET', status: res.status }];
  } finally {
    await app.close();
  }
}
