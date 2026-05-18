// apps/customer-web/test/wishlist-api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The module reads process.env at module init time. Provide values before import.
vi.stubEnv('NEXT_PUBLIC_API_BASE', 'http://test-api.local');

const { getWishlist, addToWishlist, removeFromWishlist } = await import('../lib/api');

const TEST_TOKEN = 'firebase-id-token-abc';
const TEST_SHOP  = '00000000-0000-4000-8000-000000000001';
const TEST_PROD  = '11111111-1111-4000-8000-000000000001';

function makeItem(productId: string) {
  return {
    productId,
    sku: 'GLD-001',
    purity: 'GOLD_22K',
    metal: 'GOLD',
    grossWeightG: '10.000',
    netWeightG: '9.500',
    huid: null,
    addedAt: '2026-05-18T10:00:00.000Z',
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getWishlist', () => {
  it('calls GET /api/v1/wishlist with correct auth headers and returns items', async () => {
    const item = makeItem(TEST_PROD);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([item]), { status: 200 }),
    );

    const result = await getWishlist(TEST_TOKEN, TEST_SHOP);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://test-api.local/api/v1/wishlist');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${TEST_TOKEN}`);
    expect((opts.headers as Record<string, string>)['X-Tenant-Id']).toBe(TEST_SHOP);
    expect(result).toHaveLength(1);
    expect(result[0]!.productId).toBe(TEST_PROD);
  });

  it('returns [] when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    const result = await getWishlist(TEST_TOKEN, TEST_SHOP);
    expect(result).toEqual([]);
  });

  it('returns [] on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network fail'));
    const result = await getWishlist(TEST_TOKEN, TEST_SHOP);
    expect(result).toEqual([]);
  });
});

describe('addToWishlist', () => {
  it('calls POST /api/v1/wishlist with productId body and returns true on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ added: true }), { status: 201 }),
    );

    const ok = await addToWishlist(TEST_PROD, TEST_TOKEN, TEST_SHOP);

    expect(ok).toBe(true);
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://test-api.local/api/v1/wishlist');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({ productId: TEST_PROD });
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('returns false when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
    const ok = await addToWishlist(TEST_PROD, TEST_TOKEN, TEST_SHOP);
    expect(ok).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network fail'));
    const ok = await addToWishlist(TEST_PROD, TEST_TOKEN, TEST_SHOP);
    expect(ok).toBe(false);
  });
});

describe('removeFromWishlist', () => {
  it('calls DELETE /api/v1/wishlist/:productId with auth headers and returns true', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

    const ok = await removeFromWishlist(TEST_PROD, TEST_TOKEN, TEST_SHOP);

    expect(ok).toBe(true);
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://test-api.local/api/v1/wishlist/${TEST_PROD}`);
    expect(opts.method).toBe('DELETE');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it('returns false on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Error', { status: 500 }));
    const ok = await removeFromWishlist(TEST_PROD, TEST_TOKEN, TEST_SHOP);
    expect(ok).toBe(false);
  });
});
