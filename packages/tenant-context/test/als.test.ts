import { describe, it, expect } from 'vitest';
import { tenantContext } from '../src/als';

const A = { shopId: '11111111-1111-1111-1111-111111111111' };

describe('tenantContext (ALS)', () => {
  it('current() is undefined outside runWith', () => {
    expect(tenantContext.current()).toBeUndefined();
  });

  it('runWith makes current() return the ctx', async () => {
    await tenantContext.runWith(A as never, async () => {
      expect(tenantContext.current()?.shopId).toBe(A.shopId);
    });
    expect(tenantContext.current()).toBeUndefined();
  });

  it('context survives await + Promise.all', async () => {
    await tenantContext.runWith(A as never, async () => {
      await Promise.all([
        (async () => { await new Promise((r) => setImmediate(r)); expect(tenantContext.current()?.shopId).toBe(A.shopId); })(),
        (async () => { await new Promise((r) => process.nextTick(r));  expect(tenantContext.current()?.shopId).toBe(A.shopId); })(),
      ]);
    });
  });

  it('requireCurrent throws when unset', () => {
    expect(() => tenantContext.requireCurrent()).toThrow(/tenant\.context_not_set/);
  });
});
