import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signImpersonationToken, verifyImpersonationToken, ImpersonationTokenError } from './impersonation-token';

const SECRET = 'unit-test-secret-32-bytes-minimum-aaaaaaaaaaaaa';

describe('impersonation-token', () => {
  it('signs and verifies a token for the same secret', () => {
    const token = signImpersonationToken({
      sessionId: '11111111-1111-1111-1111-111111111111',
      platformUserId: 'platform-uid-1',
      targetShopId: '22222222-2222-2222-2222-222222222222',
      ttlSeconds: 1800,
      secret: SECRET,
    });
    const claims = verifyImpersonationToken(token, SECRET);
    expect(claims.jti).toBe('11111111-1111-1111-1111-111111111111');
    expect(claims.sub).toBe('platform-uid-1');
    expect(claims.target_shop_id).toBe('22222222-2222-2222-2222-222222222222');
    expect(claims.iss).toBe('goldsmith-platform-admin');
  });

  it('rejects an expired token', () => {
    const token = signImpersonationToken({
      sessionId: '11111111-1111-1111-1111-111111111111',
      platformUserId: 'p',
      targetShopId: '22222222-2222-2222-2222-222222222222',
      ttlSeconds: -10,
      secret: SECRET,
    });
    expect(() => verifyImpersonationToken(token, SECRET)).toThrow(ImpersonationTokenError);
  });

  it('rejects a token signed by a different secret', () => {
    const token = signImpersonationToken({
      sessionId: '11111111-1111-1111-1111-111111111111',
      platformUserId: 'p',
      targetShopId: '22222222-2222-2222-2222-222222222222',
      ttlSeconds: 1800,
      secret: SECRET,
    });
    expect(() => verifyImpersonationToken(token, 'wrong-secret-xxxxxxxxxxxxxxxxxxxxx')).toThrow(ImpersonationTokenError);
  });

  it('rejects a malformed token', () => {
    expect(() => verifyImpersonationToken('not-a-jwt', SECRET)).toThrow(ImpersonationTokenError);
  });

  it('rejects when issuer is wrong', () => {
    const token = jwt.sign(
      { sub: 'p', target_shop_id: '22222222-2222-2222-2222-222222222222', iss: 'attacker' },
      SECRET,
      { algorithm: 'HS256', expiresIn: '5m', jwtid: '11111111-1111-1111-1111-111111111111' },
    );
    expect(() => verifyImpersonationToken(token, SECRET)).toThrow(ImpersonationTokenError);
  });
});
