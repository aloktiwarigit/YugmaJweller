import { describe, it, expect, vi, beforeEach } from 'vitest';

const getIdTokenMock = vi.fn();
let currentUserMock: { getIdToken: typeof getIdTokenMock } | null = null;

vi.mock('@react-native-firebase/auth', () => ({
  default: (): { get currentUser(): typeof currentUserMock } => ({ get currentUser(): typeof currentUserMock { return currentUserMock; } }),
}));

import { getIdToken } from '../src/getIdToken';

describe('getIdToken', () => {
  beforeEach(() => {
    getIdTokenMock.mockReset();
    currentUserMock = null;
  });

  it('returns null when no user signed in', async () => {
    currentUserMock = null;
    expect(await getIdToken()).toBeNull();
  });

  it('returns the token when a user is signed in', async () => {
    getIdTokenMock.mockResolvedValue('idtok_live');
    currentUserMock = { getIdToken: getIdTokenMock };
    expect(await getIdToken()).toBe('idtok_live');
    expect(getIdTokenMock).toHaveBeenCalledWith(false);
  });

  it('forces a refresh when forceRefresh=true', async () => {
    getIdTokenMock.mockResolvedValue('idtok_fresh');
    currentUserMock = { getIdToken: getIdTokenMock };
    expect(await getIdToken(true)).toBe('idtok_fresh');
    expect(getIdTokenMock).toHaveBeenCalledWith(true);
  });
});
