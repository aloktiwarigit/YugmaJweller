import { describe, it, expect, beforeEach } from 'vitest';
import { useTenantStore } from './tenantStore';
import { makeTenant } from '../../test/factories';

describe('tenantStore', () => {
  beforeEach(() => {
    useTenantStore.setState({ slug: null, tenant: null, etag: null, loading: true, error: null });
  });

  it('starts in loading state with no tenant', () => {
    const s = useTenantStore.getState();
    expect(s.tenant).toBeNull();
    expect(s.loading).toBe(true);
  });

  it('setTenant clears loading and stores etag', () => {
    const t = makeTenant();
    useTenantStore.getState().setTenant(t, '"v1"');
    const s = useTenantStore.getState();
    expect(s.tenant).toEqual(t);
    expect(s.etag).toBe('"v1"');
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('setError clears loading and stores message', () => {
    useTenantStore.getState().setError('boom');
    const s = useTenantStore.getState();
    expect(s.error).toBe('boom');
    expect(s.loading).toBe(false);
  });

  it('setSlug updates only slug', () => {
    useTenantStore.getState().setSlug('new-slug');
    expect(useTenantStore.getState().slug).toBe('new-slug');
  });
});
