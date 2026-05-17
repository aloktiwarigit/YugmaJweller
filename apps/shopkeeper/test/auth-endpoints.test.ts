import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@goldsmith/auth-client', () => ({
  getIdToken: vi.fn().mockResolvedValue(null),
}));

import MockAdapter from 'axios-mock-adapter';
import { api } from '../src/api/client';
import { getAuthMe, postAuthSession } from '../src/api/endpoints';

const mock = new MockAdapter(api);

function parseJsonBody(data: unknown): unknown {
  return typeof data === 'string' ? JSON.parse(data) : data;
}

describe('auth endpoint helpers', () => {
  beforeEach(() => {
    mock.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mock.reset();
  });

  it('posts the Firebase token to /api/v1/auth/session', async () => {
    mock.onPost('/api/v1/auth/session').reply((config) => {
      expect(parseJsonBody(config.data)).toEqual({ idToken: 'firebase-id-token' });
      return [
        200,
        {
          user: { id: 'u1', shopId: 's1', role: 'owner', displayName: 'Test User' },
          tenant: { id: 't1', slug: 'anchor-dev', displayName: 'Test Shop' },
          requires_token_refresh: false,
        },
      ];
    });

    const session = await postAuthSession('firebase-id-token');

    expect(session.user.id).toBe('u1');
    expect(session.tenant).toEqual({ id: 't1', slug: 'anchor-dev', displayName: 'Test Shop' });
    expect(mock.history.post[0]?.url).toBe('/api/v1/auth/session');
  });

  it('loads the current user and tenant from /api/v1/auth/me', async () => {
    mock.onGet('/api/v1/auth/me').reply(200, {
      user: { id: 'u1', shopId: 's1', role: 'owner', displayName: 'Test User' },
      tenant: { id: 't1', slug: 'anchor-dev', displayName: 'Test Shop' },
    });

    const session = await getAuthMe();

    expect(session).toEqual({
      user: { id: 'u1', shopId: 's1', role: 'owner', displayName: 'Test User' },
      tenant: { id: 't1', slug: 'anchor-dev', displayName: 'Test Shop' },
    });
    expect(mock.history.get[0]?.url).toBe('/api/v1/auth/me');
  });

  it('rejects /api/v1/auth/me responses without tenant binding', async () => {
    mock.onGet('/api/v1/auth/me').reply(200, {
      user: { id: 'u1', shopId: 's1', role: 'owner', displayName: 'Test User' },
    });

    await expect(getAuthMe()).rejects.toThrow('auth.tenant_missing');
  });
});
