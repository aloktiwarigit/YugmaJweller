import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tenantConfig = {
  shopId:          'shop-1',
  primaryColor:    '#B58A3C',
  logoUrl:         null,
  appName:         'Demo Jewellers',
  defaultLanguage: 'hi-IN',
};

describe('catalog API helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_URL', 'https://api.example.test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('retries tenant config when the first request fails transiently', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('cold start timeout'))
      .mockResolvedValueOnce(new Response(JSON.stringify(tenantConfig), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchTenantConfig } = await import('./api');
    const result = await fetchTenantConfig('anchor-dev-2');

    expect(result).toEqual(tenantConfig);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries tenant config on 503 before returning success', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('warming', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(tenantConfig), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchTenantConfig } = await import('./api');
    const result = await fetchTenantConfig('anchor-dev-2');

    expect(result).toEqual(tenantConfig);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
