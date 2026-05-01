import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api } from './client';
import { useTenantStore } from '../stores/tenantStore';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { makeTenant, makeCustomer } from '../../test/factories';

describe('api client', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    useTenantStore.setState({ slug: null, tenant: null, etag: null, loading: false, error: null });
    useCustomerSessionStore.setState({ customer: null, bearer: null });
  });

  it('attaches x-tenant-id when tenant resolved', async () => {
    useTenantStore.setState({ tenant: makeTenant() });
    mock.onGet('/api/v1/whatever').reply((cfg) => {
      expect(cfg.headers?.['x-tenant-id']).toBe(makeTenant().id);
      return [200, {}];
    });
    await api.get('/api/v1/whatever');
  });

  it('attaches Authorization when bearer set', async () => {
    useCustomerSessionStore.setState({
      customer: makeCustomer(),
      bearer: 'mock-token-abc',
    });
    mock.onGet('/api/v1/whatever').reply((cfg) => {
      expect(cfg.headers?.['Authorization']).toBe('Bearer mock-token-abc');
      return [200, {}];
    });
    await api.get('/api/v1/whatever');
  });

  it('omits Authorization when no bearer', async () => {
    mock.onGet('/api/v1/whatever').reply((cfg) => {
      expect(cfg.headers?.['Authorization']).toBeUndefined();
      return [200, {}];
    });
    await api.get('/api/v1/whatever');
  });
});
