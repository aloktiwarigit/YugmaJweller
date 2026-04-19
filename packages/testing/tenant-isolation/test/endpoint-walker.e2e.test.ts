import { describe, it, expect, beforeAll } from 'vitest';
import { walkHealthz } from '../src/endpoint-walker';
import { AppModule } from '@goldsmith/api/src/app.module';

beforeAll(() => {
  // AuthModule's FirebaseAdminProvider needs these env vars.
  // Point at the emulator so no real Firebase credentials are required.
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= '127.0.0.1:9099';
  process.env['FIREBASE_PROJECT_ID'] ??= 'goldsmith-test';
});

describe('endpoint walker (E2-S1 scaffold)', () => {
  it('exercises /healthz and confirms 200', async () => {
    const res = await walkHealthz(AppModule);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ route: '/healthz', method: 'GET', status: 200 });
  });
});
