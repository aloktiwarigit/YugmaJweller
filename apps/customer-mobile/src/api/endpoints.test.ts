import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api } from './client';
import {
  getTenantBoot,
  getPublicRates,
  listPublicProducts,
  customerSelfDelete,
  getPurchases,
  getCustomOrders,
  getRateLockBookings,
  getTryAtHomeBookings,
} from './endpoints';

describe('endpoints', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
  });

  it('getTenantBoot maps snake_case API response (flat config keys) to mobile Tenant shape', async () => {
    mock.onGet('/api/v1/tenant/boot').reply(
      200,
      {
        id: 'tid',
        display_name: 'Test Shop',
        config: {
          app_name: 'Test Shop App',
          default_language: 'hi-IN',
          primary_color: '#8C2A1E',
          logo_url: 'https://cdn.example/logo.png',
        },
      },
      { etag: '"v1"' },
    );
    const r = await getTenantBoot('anchor-dev');
    expect(r.tenant.id).toBe('tid');
    expect(r.tenant.slug).toBe('anchor-dev');
    expect(r.tenant.displayName).toBe('Test Shop');
    expect(r.tenant.branding.appName).toBe('Test Shop App');
    expect(r.tenant.branding.defaultLanguage).toBe('hi-IN');
    expect(r.tenant.branding.primaryColor).toBe('#8C2A1E');
    expect(r.tenant.branding.logoUrl).toBe('https://cdn.example/logo.png');
    expect(r.etag).toBe('"v1"');
    expect(r.notModified).toBe(false);
  });

  it('getTenantBoot ignores invalid types and unknown keys in config', async () => {
    mock.onGet('/api/v1/tenant/boot').reply(
      200,
      {
        id: 'tid',
        display_name: 'Bare Shop',
        config: { primary_color: 42, default_language: 'fr-FR', extra_unknown: 'ignored' },
      },
      { etag: '"v2"' },
    );
    const r = await getTenantBoot('anchor-dev');
    expect(r.tenant.branding.primaryColor).toBeUndefined();
    expect(r.tenant.branding.defaultLanguage).toBeUndefined();
  });

  it('getTenantBoot defaults branding to empty when config is null', async () => {
    mock.onGet('/api/v1/tenant/boot').reply(
      200,
      { id: 'tid', display_name: 'Bare Shop', config: null },
      { etag: '"v3"' },
    );
    const r = await getTenantBoot('anchor-dev');
    expect(r.tenant.branding).toEqual({
      primaryColor: undefined,
      secondaryColor: undefined,
      logoUrl: undefined,
      appName: undefined,
      defaultLanguage: undefined,
    });
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

describe('customer timeline endpoints', () => {
  let mock: MockAdapter;
  beforeEach(() => { mock = new MockAdapter(api); });
  afterEach(() => mock.reset());

  it('getPurchases returns invoices list', async () => {
    const payload = {
      invoices: [{ invoiceId: 'inv-1', invoiceNumber: 'INV-001',
        issuedAt: '2026-04-01T10:00:00.000Z', totalPaise: '250000', status: 'PAID' }],
      total: 1,
    };
    mock.onGet('/api/v1/customer/purchases').reply(200, payload);
    const result = await getPurchases({ limit: 20, offset: 0 });
    expect(result).toEqual(payload);
  });

  it('getCustomOrders returns orders list', async () => {
    const payload = {
      orders: [{ id: 'ord-1', status: 'IN_PROGRESS', description: 'Ring',
        quotedAmountPaise: '100000', depositAmountPaise: '20000',
        estimatedDeliveryDate: null, createdAt: '2026-04-01T10:00:00.000Z' }],
      total: 1,
    };
    mock.onGet('/api/v1/customer/custom-orders').reply(200, payload);
    const result = await getCustomOrders({ limit: 20, offset: 0 });
    expect(result).toEqual(payload);
  });

  it('getRateLockBookings returns bookings list', async () => {
    const payload = {
      bookings: [{ id: 'rl-1', status: 'ACTIVE',
        lockedRate24kPaisePerGram: '700000', depositAmountPaise: '50000',
        expiresAt: '2026-05-05T10:00:00.000Z', lockedAt: '2026-05-04T10:00:00.000Z' }],
      total: 1,
    };
    mock.onGet('/api/v1/customer/rate-lock/bookings').reply(200, payload);
    const result = await getRateLockBookings({ limit: 20, offset: 0 });
    expect(result).toEqual(payload);
  });

  it('getTryAtHomeBookings returns bookings list', async () => {
    const payload = {
      bookings: [{ id: 'tah-1', shopId: 'shop-1', customerId: 'cust-1',
        productIds: ['p1'], status: 'REQUESTED',
        requestedAt: '2026-05-01T08:00:00.000Z',
        dispatchAt: null, returnDueAt: null, notes: null }],
      total: 1,
    };
    mock.onGet('/api/v1/customer/try-at-home/bookings').reply(200, payload);
    const result = await getTryAtHomeBookings({ limit: 20, offset: 0 });
    expect(result).toEqual(payload);
  });
});
