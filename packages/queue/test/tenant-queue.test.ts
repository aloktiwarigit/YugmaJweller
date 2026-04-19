import { describe, it, expect } from 'vitest';
import type { Tenant, UnauthenticatedTenantContext } from '@goldsmith/tenant-context';
import { buildJobPayload, extractTenantId } from '../src/tenant-queue';

const tenantA: Tenant = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', slug: 'a', display_name: 'A', status: 'ACTIVE' };
const A: UnauthenticatedTenantContext = { shopId: tenantA.id, tenant: tenantA, authenticated: false };

describe('tenant-queue payload shape', () => {
  it('buildJobPayload wraps data with meta.tenantId from ctx', () => {
    expect(buildJobPayload(A, { foo: 1 })).toEqual({
      meta: { tenantId: A.shopId },
      data: { foo: 1 },
    });
  });

  it('extractTenantId reads meta.tenantId', () => {
    expect(extractTenantId({ meta: { tenantId: A.shopId }, data: {} })).toBe(A.shopId);
  });

  it('extractTenantId throws on missing meta', () => {
    expect(() => extractTenantId({} as never)).toThrow(/queue\.missing_tenant_meta/);
  });
});
