import { describe, it, expect, vi } from 'vitest';
import { FirebaseJwtStrategy } from '../src/modules/auth/firebase-jwt.strategy';

describe('FirebaseJwtStrategy', () => {
  const mockAdmin = {
    auth: () => ({
      verifyIdToken: vi.fn(async (token: string) => {
        if (token === 'valid') return { uid: 'u1', phone_number: '+919000000001', shop_id: 'a', role: 'shop_admin' };
        if (token === 'expired') throw Object.assign(new Error('expired'), { code: 'auth/id-token-expired' });
        throw Object.assign(new Error('invalid'), { code: 'auth/argument-error' });
      }),
    }),
  };

  // pool is Optional — pass undefined for unit tests (no DB needed)
  it('valid token returns decoded claims as req.user', async () => {
    const s = new FirebaseJwtStrategy(mockAdmin as never, undefined);
    await expect(s.validate('valid')).resolves.toMatchObject({ uid: 'u1', phone_number: '+919000000001' });
  });

  it('expired token → UnauthorizedException with auth.token_invalid', async () => {
    const s = new FirebaseJwtStrategy(mockAdmin as never, undefined);
    await expect(s.validate('expired')).rejects.toMatchObject({ response: { code: 'auth.token_invalid' } });
  });

  it('malformed token → UnauthorizedException with auth.token_invalid', async () => {
    const s = new FirebaseJwtStrategy(mockAdmin as never, undefined);
    await expect(s.validate('bogus')).rejects.toMatchObject({ response: { code: 'auth.token_invalid' } });
  });
});
