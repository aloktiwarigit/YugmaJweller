import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @goldsmith/auth-client before any import of client.ts.
// IMPORTANT: vi.mock is hoisted to top of file by vitest, so factory cannot
// reference variables declared in the outer scope (they are not yet initialised
// at the time the hoisted factory runs). Use a module-level spy that we reset
// in beforeEach instead of referencing an outer `const getIdTokenMock` inside
// the factory.
vi.mock('@goldsmith/auth-client', () => ({
  getIdToken: vi.fn().mockResolvedValue(null),
}));

import * as authClient from '@goldsmith/auth-client';
// Convenience alias typed as a spy for use in test assertions
const getIdTokenMock = vi.mocked(authClient.getIdToken);

import MockAdapter from 'axios-mock-adapter';
import { api } from '../src/api/client';

const mock = new MockAdapter(api);

describe('api client — request interceptor', () => {
  beforeEach(() => {
    mock.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mock.reset();
  });

  it('attaches Authorization: Bearer header from getIdToken', async () => {
    getIdTokenMock.mockResolvedValue('tok-abc');
    mock.onGet('/health').reply(200, { ok: true });

    const res = await api.get('/health');
    expect(res.status).toBe(200);

    // Confirm the outbound request carried the token
    const request = mock.history.get[0];
    expect(request?.headers?.['Authorization']).toBe('Bearer tok-abc');
  });

  it('sends request without Authorization header when getIdToken returns null', async () => {
    getIdTokenMock.mockResolvedValue(null);
    mock.onGet('/health').reply(200, { ok: true });

    await api.get('/health');
    const request = mock.history.get[0];
    expect(request?.headers?.['Authorization']).toBeUndefined();
  });
});

describe('api client — response interceptor (claim-missing retry)', () => {
  beforeEach(() => {
    mock.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mock.reset();
  });

  it('retries ONCE with force-refreshed token on 401 auth.claim_missing, succeeds on 2nd attempt', async () => {
    // First call → 401 claim_missing; second call → 200
    getIdTokenMock
      .mockResolvedValueOnce('old-tok')  // initial request interceptor (forceRefresh=false)
      .mockResolvedValueOnce('new-tok')  // retry response interceptor (forceRefresh=true)
      .mockResolvedValueOnce('new-tok'); // retried request also runs through request interceptor

    mock
      .onGet('/protected')
      .replyOnce(401, { code: 'auth.claim_missing' })
      .onGet('/protected')
      .replyOnce(200, { data: 'ok' });

    const res = await api.get('/protected');
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ data: 'ok' });

    // Verify getIdToken call sequence:
    // 1. Request interceptor on original request → getIdToken(false) → 'old-tok'
    // 2. Response interceptor on 401 claim_missing → getIdToken(true) → 'new-tok' (force-refresh)
    // 3. Request interceptor on retried request → getIdToken(false) (retried request also runs through interceptor)
    expect(getIdTokenMock).toHaveBeenCalledTimes(3);
    expect(getIdTokenMock).toHaveBeenNthCalledWith(1, false);
    expect(getIdTokenMock).toHaveBeenNthCalledWith(2, true);
    expect(getIdTokenMock).toHaveBeenNthCalledWith(3, false);

    // Verify second request carried the refreshed token (set by response interceptor before re-dispatch)
    const requests = mock.history.get;
    expect(requests).toHaveLength(2);
    expect(requests[1]?.headers?.['Authorization']).toBe('Bearer new-tok');
  });

  it('does NOT retry on 401 with a non-claim-missing code', async () => {
    getIdTokenMock.mockResolvedValue('tok');
    mock.onGet('/protected').reply(401, { code: 'auth.token_invalid' });

    await expect(api.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });

    // Only one request — no retry
    expect(mock.history.get).toHaveLength(1);
    // getIdToken only called once (request interceptor only)
    expect(getIdTokenMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 401 auth.claim_missing a second time (no infinite loop)', async () => {
    // Both calls return claim_missing — interceptor must bail after 1 retry
    getIdTokenMock
      .mockResolvedValueOnce('old-tok') // original request
      .mockResolvedValueOnce('new-tok'); // first retry

    mock
      .onGet('/protected')
      .replyOnce(401, { code: 'auth.claim_missing' }) // original
      .onGet('/protected')
      .replyOnce(401, { code: 'auth.claim_missing' }); // retry also 401

    await expect(api.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });

    // Exactly 2 requests (original + 1 retry), not 3+
    expect(mock.history.get).toHaveLength(2);
  });
});
