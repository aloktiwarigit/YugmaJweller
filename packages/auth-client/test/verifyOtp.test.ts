import { describe, it, expect, vi } from 'vitest';
vi.mock('@react-native-firebase/auth', () => ({ default: () => ({}) }));

import { verifyOtp } from '../src/verifyOtp';

describe('verifyOtp', () => {
  it('returns the idToken from the confirmed credential', async () => {
    const confirmation = {
      confirm: vi.fn().mockResolvedValue({ user: { getIdToken: vi.fn().mockResolvedValue('idtok_abc') } }),
    };
    await expect(verifyOtp(confirmation as never, '123456')).resolves.toEqual({ idToken: 'idtok_abc' });
  });

  it('throws auth-client.verify_failed when confirm returns no user', async () => {
    const confirmation = { confirm: vi.fn().mockResolvedValue(null) };
    await expect(verifyOtp(confirmation as never, '000000')).rejects.toThrow('auth-client.verify_failed');
  });
});
