import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api } from './client';
import {
  getTenantBoot,
  getPublicRates,
  listPublicProducts,
  customerSelfDelete,
} from './endpoints';

describe('endpoints', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  it('getTenantBoot maps snake_case API response to mobile Tenant shape', async () => {
    mock.onGet('/api/v1/tenant/boot').reply(
      200,
      {
        id: 'tid',
        display_name: 'Test Shop',
        config: { branding: { primaryColor: '#8C2A1E', appName: 'Test Shop' } },
      },
      { etag: '"v1"' },
    );
    const r = await getTenantBoot('anchor-dev');
    expect(r.tenant.id).toBe('tid');
    expect(r.tenant.slug).toBe('anchor-dev');
    expect(r.tenant.displayName).toBe('Test Shop');
    expect(r.tenant.branding.primaryColor).toBe('#8C2A1E');
    expect(r.etag).toBe('"v1"');
    expect(r.notModified).toBe(false);
  });

  it('getTenantBoot defaults branding to empty when config has none', async () => {
    mock.onGet('/api/v1/tenant/boot').reply(
      200,
      { id: 'tid', display_name: 'Bare Shop', config: null },
      { etag: '"v2"' },
    );
    const r = await getTenantBoot('anchor-dev');
    expect(r.tenant.branding).toEqual({});
  });

  it('getTenantBoot handles 304', async () => {
    mock.onGet('/api/v1/tenant/boot').reply(304);
    const r = await getTenantBoot('anchor-dev', '"v1"');
    expect(r.notModified).toBe(true);
    expect(r.etag).toBe('"v1"');
  });

  it('getPublicRates returns rates', async () => {
    mock.onGet('/api/v1/catalog/rates').reply(200, {
      GOLD_24K: { perGramRupees: '7500.00', formattedINR: '₹7,500.00', fetchedAt: '2026-04-30T00:00:00Z' },
      GOLD_22K: { perGramRupees: '6900.00', formattedINR: '₹6,900.00', fetchedAt: '2026-04-30T00:00:00Z' },
      SILVER_999: { perGramRupees: '90.00', formattedINR: '₹90.00', fetchedAt: '2026-04-30T00:00:00Z' },
      stale: false,
      source: 'IBJA',
      refreshedAt: '2026-04-30T00:00:00Z',
    });
    const r = await getPublicRates();
    expect(r.GOLD_24K.formattedINR).toBe('₹7,500.00');
  });

  it('listPublicProducts returns items array', async () => {
    mock.onGet('/api/v1/catalog/products').reply(200, { items: [], total: 0, tenantId: 'tid' });
    const r = await listPublicProducts({ limit: 6 });
    expect(r.items).toEqual([]);
  });

  it('customerSelfDelete maps 501 NotImplemented to typed error', async () => {
    mock.onDelete('/api/v1/crm/customer/me').reply(501, { code: 'deletion.customer_app_not_yet_available' });
    await expect(customerSelfDelete()).rejects.toMatchObject({
      code: 'deletion.customer_app_not_yet_available',
    });
  });
});
