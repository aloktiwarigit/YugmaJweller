import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after stubbing fetch so resolveApiUrl() runs with process.env.
// In test environment, NEXT_PUBLIC_API_BASE is unset → falls back to
// 'http://localhost:3001' (see resolveApiUrl() in lib/api.ts).
const { fetchCustomerPurchases, fetchCustomerRateLocks, fetchCustomerTryAtHomeBookings } =
  await import('../lib/api');

const SHOP = 'shop-uuid-0001';
const TOKEN = 'bearer-token-abc';
const BASE = 'http://localhost:3001';

beforeEach(() => { vi.clearAllMocks(); });

// ── fetchCustomerPurchases ────────────────────────────────────────────────

describe('fetchCustomerPurchases', () => {
  it('calls the correct URL with Authorization + X-Tenant-Id headers', async () => {
    mockFetch.mockResolvedValue({
      ok:   true,
      json: async () => ({ invoices: [], total: 0 }),
    });
    await fetchCustomerPurchases(SHOP, TOKEN);
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toContain(`${BASE}/api/v1/customer/purchases`);
    expect((opts as RequestInit).headers).toMatchObject({
      Authorization: `Bearer ${TOKEN}`,
      'X-Tenant-Id': SHOP,
    });
  });

  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    expect(await fetchCustomerPurchases(SHOP, TOKEN)).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    expect(await fetchCustomerPurchases(SHOP, TOKEN)).toBeNull();
  });

  it('returns parsed response on success', async () => {
    const payload = {
      invoices: [{ invoiceId: 'inv-1', invoiceNumber: 'INV-001', issuedAt: '2026-01-01T00:00:00Z', totalPaise: '1000000', status: 'ISSUED', lineCount: 2, paymentMethod: 'CASH' }],
      total: 1,
    };
    mockFetch.mockResolvedValue({ ok: true, json: async () => payload });
    expect(await fetchCustomerPurchases(SHOP, TOKEN)).toEqual(payload);
  });
});

// ── fetchCustomerRateLocks ────────────────────────────────────────────────

describe('fetchCustomerRateLocks', () => {
  it('calls correct URL with auth headers', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ bookings: [], total: 0 }) });
    await fetchCustomerRateLocks(SHOP, TOKEN);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/api/v1/customer/rate-lock/bookings');
  });

  it('returns null on error', async () => {
    mockFetch.mockRejectedValue(new Error('fail'));
    expect(await fetchCustomerRateLocks(SHOP, TOKEN)).toBeNull();
  });
});

// ── fetchCustomerTryAtHomeBookings ────────────────────────────────────────

describe('fetchCustomerTryAtHomeBookings', () => {
  it('calls correct URL with auth headers', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ bookings: [], total: 0 }) });
    await fetchCustomerTryAtHomeBookings(SHOP, TOKEN);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/api/v1/customer/try-at-home/bookings');
  });

  it('returns null on non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });
    expect(await fetchCustomerTryAtHomeBookings(SHOP, TOKEN)).toBeNull();
  });
});
