// Smoke: callCustomerSessionEndpoint constructs the right URL and headers
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    customer: { id: 'db-uuid', name: 'Test', phoneE164: null, email: 'a@b.com' },
    isNewUser: true,
    authProvider: 'google',
  }),
});

global.fetch = mockFetch as typeof fetch;

describe('callCustomerSessionEndpoint', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('posts to /api/v1/customer/auth/session with correct headers', async () => {
    const { callCustomerSessionEndpoint } = await import('../lib/api');
    await callCustomerSessionEndpoint('id-token-abc', 'shop-uuid-123');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/customer/auth/session'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer id-token-abc',
          'X-Tenant-Id': 'shop-uuid-123',
        }),
      }),
    );
  });

  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { callCustomerSessionEndpoint } = await import('../lib/api');
    const result = await callCustomerSessionEndpoint('bad-token', 'shop-id');
    expect(result).toBeNull();
  });
});
