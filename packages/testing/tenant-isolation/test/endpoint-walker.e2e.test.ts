import { describe, it, expect } from 'vitest';
import { walkHealthz } from '../src/endpoint-walker';
import { AppModule } from '@goldsmith/api/src/app.module';

describe('endpoint walker (E2-S1 scaffold)', () => {
  it('exercises /healthz and confirms 200', async () => {
    const res = await walkHealthz(AppModule);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ route: '/healthz', method: 'GET', status: 200 });
  });
});
