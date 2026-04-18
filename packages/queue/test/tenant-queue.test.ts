import { describe, it, expect } from 'vitest';
import { buildJobPayload, extractTenantId } from '../src/tenant-queue';

const A = { shopId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };

describe('tenant-queue payload shape', () => {
  it('buildJobPayload wraps data with meta.tenantId from ctx', () => {
    expect(buildJobPayload(A as never, { foo: 1 })).toEqual({
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
