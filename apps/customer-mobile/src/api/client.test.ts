import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import Constants from 'expo-constants';
import { api } from './client';
import { useTenantStore } from '../stores/tenantStore';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { DEV_MOCK_BEARER_PREFIX } from '../lib/dev-mock-session';
import { makeTenant, makeCustomer } from '../../test/factories';

describe('api client', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    Constants.expoConfig!.extra!['devAuth'] = false;
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

  it('does not clear dev mock sessions when a private endpoint returns 401', async () => {
    Constants.expoConfig!.extra!['devAuth'] = true;
    const customer = makeCustomer();
    const bearer = `${DEV_MOCK_BEARER_PREFIX}test`;
    useCustomerSessionStore.setState({ customer, bearer });
    mock.onGet('/api/v1/private').reply(401, {});

    await expect(api.get('/api/v1/private')).rejects.toBeDefined();

    expect(useCustomerSessionStore.getState().customer).toEqual(customer);
    expect(useCustomerSessionStore.getState().bearer).toBe(bearer);
  });
});
