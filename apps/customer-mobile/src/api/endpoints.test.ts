import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
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
  getCatalogProducts,
  getProductImages,
  getNewArrivalProducts,
  getTopSellerProducts,
  getCollections,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from './endpoints';
import { demoShopImageUris } from '../assets/demoShopImageData';
import { DEV_MOCK_BEARER_PREFIX } from '../lib/dev-mock-session';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { useTenantStore } from '../stores/tenantStore';

describe('endpoints', () => {
  let mock: MockAdapter;

  beforeEach(async () => {
    mock = new MockAdapter(api);
    Constants.expoConfig!.extra!['devAuth'] = false;
    useCustomerSessionStore.setState({ customer: null, bearer: null });
    useTenantStore.setState({ slug: null, tenant: null, etag: null, loading: false, error: null });
    await AsyncStorage.clear();
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
    expect(r.tenant!.id).toBe('tid');
    expect(r.tenant!.slug).toBe('anchor-dev');
    expect(r.tenant!.displayName).toBe('Test Shop');
    expect(r.tenant!.branding.appName).toBe('Test Shop App');
    expect(r.tenant!.branding.defaultLanguage).toBe('hi-IN');
    expect(r.tenant!.branding.primaryColor).toBe('#8C2A1E');
    expect(r.tenant!.branding.logoUrl).toBe('https://cdn.example/logo.png');
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
    expect(r.tenant!.branding.primaryColor).toBeUndefined();
    expect(r.tenant!.branding.defaultLanguage).toBeUndefined();
  });

  it('getTenantBoot defaults branding to empty when config is null', async () => {
    mock.onGet('/api/v1/tenant/boot').reply(
      200,
      { id: 'tid', display_name: 'Bare Shop', config: null },
      { etag: '"v3"' },
    );
    const r = await getTenantBoot('anchor-dev');
    expect(r.tenant!.branding).toEqual({
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

  it('normalizes relative catalog image URLs against the API origin', async () => {
    mock.onGet('/api/v1/catalog/products').reply(200, {
      items: [{
        id: 'prod-1',
        sku: 'SKU-1',
        metal: 'GOLD',
        purity: 'GOLD_22K',
        categoryId: null,
        categoryName: 'Gold Rings',
        grossWeightG: '5.0000',
        netWeightG: '4.8000',
        huid: 'ABC123',
        huidExemptionCategory: 'none',
        quantity: 1,
        priceAvailable: true,
        publishedAt: '2026-05-16T00:00:00.000Z',
        primaryImage: {
          url: '/demo-shop/ring-diamond.jpg',
          placeholderUrl: '/demo-shop/ring-diamond.jpg',
          srcset: '/demo-shop/ring-diamond.jpg 320w, /demo-shop/ring-diamond.jpg 640w',
          width: 1200,
          height: 1500,
          alt: 'Ring',
        },
      }],
      total: 1,
      page: 1,
    });

    const r = await getCatalogProducts();

    expect(r.items[0]?.primaryImage?.url).toBe(demoShopImageUris['ring-diamond.jpg']);
    expect(r.items[0]?.primaryImage?.placeholderUrl).toBe(demoShopImageUris['ring-diamond.jpg']);
    expect(r.items[0]?.primaryImage?.srcset).toContain(demoShopImageUris['ring-diamond.jpg']);
  });

  it('passes gift persona, collection, and weight filters to catalog products', async () => {
    mock.onGet('/api/v1/catalog/products').reply(200, { items: [], total: 0, page: 1 });

    await getCatalogProducts({
      giftPersona: 'BRIDE',
      collection: 'bridal-edit',
      weightMinG: 2,
      weightMaxG: 5,
    });

    expect(mock.history['get']?.[0]?.params).toMatchObject({
      giftPersona: 'BRIDE',
      collection:  'bridal-edit',
      weightMinG:  2,
      weightMaxG:  5,
    });
  });

  it('normalizes relative PDP gallery image URLs against the API origin', async () => {
    mock.onGet('/api/v1/catalog/products/prod-1/images').reply(200, {
      images: [{
        id: 'img-1',
        alt_text: 'Ring',
        width: 1200,
        height: 1500,
        default_url: '/demo-shop/ring-diamond.jpg',
        placeholder_url: '/demo-shop/ring-diamond.jpg',
        srcset: '/demo-shop/ring-diamond.jpg 320w',
      }],
    });

    const r = await getProductImages('prod-1');

    expect(r[0]?.default_url).toBe(demoShopImageUris['ring-diamond.jpg']);
    expect(r[0]?.placeholder_url).toBe(demoShopImageUris['ring-diamond.jpg']);
    expect(r[0]?.srcset).toContain(demoShopImageUris['ring-diamond.jpg']);
  });

  it('customerSelfDelete sends DELETE /api/v1/crm/customer/me', async () => {
    mock.onDelete('/api/v1/crm/customer/me').reply(202, {
      scheduledAt: '2026-05-16T12:00:00.000Z',
      hardDeleteAt: '2026-06-15T12:00:00.000Z',
    });
    await expect(customerSelfDelete()).resolves.toBeUndefined();
    expect(mock.history['delete']?.[0]?.url).toBe('/api/v1/crm/customer/me');
  });

  it('customerSelfDelete maps deletion API errors to typed errors', async () => {
    mock.onDelete('/api/v1/crm/customer/me').reply(422, { code: 'crm.deletion.open_invoices' });
    await expect(customerSelfDelete()).rejects.toMatchObject({
      code: 'crm.deletion.open_invoices',
      status: 422,
    });
  });

  it('customerSelfDelete sends reason in body when provided', async () => {
    let captured: unknown;
    mock.onDelete('/api/v1/crm/customer/me').reply((config) => {
      captured = config.data ? JSON.parse(config.data as string) : null;
      return [202, { scheduledAt: 'x', hardDeleteAt: 'y' }];
    });
    await customerSelfDelete({ reason: 'privacy', reasonText: 'क्योंकि' });
    expect(captured).toEqual({ reason: 'privacy', reasonText: 'क्योंकि' });
  });

  it('customerSelfDelete sends empty body when no options provided', async () => {
    let captured: unknown = 'unset';
    mock.onDelete('/api/v1/crm/customer/me').reply((config) => {
      captured = config.data ?? null;
      return [202, { scheduledAt: 'x', hardDeleteAt: 'y' }];
    });
    await customerSelfDelete();
    expect(captured === null || captured === undefined || captured === '').toBe(true);
  });
});

describe('new-arrivals and top-sellers endpoints', () => {
  let mock: MockAdapter;
  beforeEach(async () => {
    mock = new MockAdapter(api);
    Constants.expoConfig!.extra!['devAuth'] = false;
    useCustomerSessionStore.setState({ customer: null, bearer: null });
    useTenantStore.setState({ slug: null, tenant: null, etag: null, loading: false, error: null });
    await AsyncStorage.clear();
  });
  afterEach(() => mock.reset());

  it('getNewArrivalProducts calls /api/v1/catalog/products/new-arrivals', async () => {
    const payload = { items: [], total: 0, page: 1 };
    mock.onGet('/api/v1/catalog/products/new-arrivals').reply(200, payload);
    const result = await getNewArrivalProducts(8);
    expect(result.items).toEqual([]);
    expect(mock.history['get']?.[0]?.url).toBe('/api/v1/catalog/products/new-arrivals');
  });

  it('getTopSellerProducts calls /api/v1/catalog/products/top-sellers', async () => {
    const payload = { items: [], total: 0, page: 1 };
    mock.onGet('/api/v1/catalog/products/top-sellers').reply(200, payload);
    const result = await getTopSellerProducts(8);
    expect(result.items).toEqual([]);
    expect(mock.history['get']?.[0]?.url).toBe('/api/v1/catalog/products/top-sellers');
  });

  it('getCollections calls /api/v1/catalog/collections and normalizes hero images', async () => {
    mock.onGet('/api/v1/catalog/collections').reply(200, {
      items: [{
        id: 'collection-1',
        slug: 'bridal-edit',
        titleHi: 'Bridal Edit',
        heroImage: {
          url: '/demo-shop/campaign-necklace-showcase.jpg',
          placeholderUrl: '/demo-shop/campaign-necklace-showcase.jpg',
          srcset: '/demo-shop/campaign-necklace-showcase.jpg 640w',
          width: 1200,
          height: 800,
          alt: 'Bridal edit',
        },
        productCount: 8,
        isPremium: true,
      }],
    });

    const result = await getCollections();

    expect(mock.history['get']?.[0]?.url).toBe('/api/v1/catalog/collections');
    expect(result[0]?.heroImage?.url).toContain('data:image/jpeg;base64,');
  });

  it('addToWishlist posts productId to /api/v1/wishlist', async () => {
    mock.onPost('/api/v1/wishlist').reply(200);
    await addToWishlist('prod-abc');
    expect(mock.history['post']?.[0]?.url).toBe('/api/v1/wishlist');
    expect(JSON.parse(mock.history['post']?.[0]?.data as string)).toMatchObject({ productId: 'prod-abc' });
  });

  it('removeFromWishlist sends DELETE /api/v1/wishlist/:id', async () => {
    mock.onDelete('/api/v1/wishlist/prod-xyz').reply(200);
    await removeFromWishlist('prod-xyz');
    expect(mock.history['delete']?.[0]?.url).toBe('/api/v1/wishlist/prod-xyz');
  });

  it('uses a local wishlist store for dev mock customer sessions', async () => {
    Constants.expoConfig!.extra!['devAuth'] = true;
    useTenantStore.setState({
      tenant: {
        id: '71c84726-c351-46b8-9739-3278b054f9c5',
        slug: 'anchor-dev-2',
        displayName: 'Test Shop',
        branding: {},
      },
    });
    useCustomerSessionStore.setState({
      customer: {
        id: '00000000-0000-4000-8000-000000000999',
        shopId: '71c84726-c351-46b8-9739-3278b054f9c5',
        name: 'Dev Customer',
        phoneE164: '+919999999999',
        email: null,
      },
      bearer: `${DEV_MOCK_BEARER_PREFIX}test`,
    });

    await addToWishlist('prod-demo', {
      productId: 'prod-demo',
      sku: 'DMO-RG-001',
      purity: '22K',
      metal: 'GOLD',
      grossWeightG: '4.000',
      netWeightG: '3.800',
      huid: null,
      addedAt: '2026-05-23T00:00:00.000Z',
    });

    expect(await getWishlist()).toEqual([
      expect.objectContaining({ productId: 'prod-demo', sku: 'DMO-RG-001' }),
    ]);
    expect(mock.history['post']).toHaveLength(0);
    expect(mock.history['get']).toHaveLength(0);

    await removeFromWishlist('prod-demo');

    expect(await getWishlist()).toEqual([]);
    expect(mock.history['delete']).toHaveLength(0);
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
