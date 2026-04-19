import { describe, it, expect } from 'vitest';
import { tenantContext } from '../src/als';
import type {
  TenantContext,
  AuthenticatedTenantContext,
  UnauthenticatedTenantContext,
  Tenant,
} from '../src/context';

const tenantA: Tenant = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'a',
  display_name: 'Tenant A',
  status: 'ACTIVE',
};
const A: UnauthenticatedTenantContext = {
  shopId: tenantA.id,
  tenant: tenantA,
  authenticated: false,
};

describe('tenantContext (ALS)', () => {
  it('current() is undefined outside runWith', () => {
    expect(tenantContext.current()).toBeUndefined();
  });

  it('runWith makes current() return the ctx', async () => {
    await tenantContext.runWith(A, async () => {
      expect(tenantContext.current()?.shopId).toBe(A.shopId);
    });
    expect(tenantContext.current()).toBeUndefined();
  });

  it('context survives await + Promise.all', async () => {
    await tenantContext.runWith(A, async () => {
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

describe('TenantContext discriminated union', () => {
  it('Unauthenticated ctx narrows with authenticated === false', () => {
    const ctx: UnauthenticatedTenantContext = {
      shopId: tenantA.id, tenant: tenantA, authenticated: false,
    };
    expect(ctx.authenticated).toBe(false);
  });

  it('Authenticated ctx requires userId + role', () => {
    const ctx: AuthenticatedTenantContext = {
      shopId: tenantA.id, tenant: tenantA,
      authenticated: true, userId: 'u', role: 'shop_admin',
    };
    expect(ctx.userId).toBe('u');
  });

  it('runWith preserves discriminator through async boundary', async () => {
    const ctx: AuthenticatedTenantContext = {
      shopId: tenantA.id, tenant: tenantA,
      authenticated: true, userId: 'u', role: 'shop_staff',
    };
    const result = await tenantContext.runWith<string>(ctx as TenantContext, async () => {
      const current = tenantContext.requireCurrent();
      if (current.authenticated) return current.userId;
      return 'no-user';
    });
    expect(result).toBe('u');
  });
});
