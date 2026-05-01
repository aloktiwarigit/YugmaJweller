import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FirebaseJwtStrategy } from '../src/modules/auth/firebase-jwt.strategy';
import { signImpersonationToken } from '../src/modules/platform-admin/impersonation-token';

const SECRET = 'unit-test-secret-32-bytes-minimum-aaaaaaaaaaaaa';

function makeAdmin(claims: Record<string, unknown> & { uid: string }) {
  return {
    auth: () => ({
      verifyIdToken: vi.fn(async () => claims),
    }),
  };
}

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

  const fakeReq = { headers: {} } as never;

  it('valid token returns decoded claims as req.user', async () => {
    const s = new FirebaseJwtStrategy(mockAdmin as never, undefined);
    await expect(s.validate(fakeReq, 'valid')).resolves.toMatchObject({ uid: 'u1', phone_number: '+919000000001' });
  });

  it('expired token → UnauthorizedException with auth.token_invalid', async () => {
    const s = new FirebaseJwtStrategy(mockAdmin as never, undefined);
    await expect(s.validate(fakeReq, 'expired')).rejects.toMatchObject({ response: { code: 'auth.token_invalid' } });
  });

  it('malformed token → UnauthorizedException with auth.token_invalid', async () => {
    const s = new FirebaseJwtStrategy(mockAdmin as never, undefined);
    await expect(s.validate(fakeReq, 'bogus')).rejects.toMatchObject({ response: { code: 'auth.token_invalid' } });
  });
});

describe('FirebaseJwtStrategy — impersonation', () => {
  beforeEach(() => { process.env['IMPERSONATION_JWT_SECRET'] = SECRET; });
  afterEach(() => { delete process.env['IMPERSONATION_JWT_SECRET']; });

  it('rewrites shop_id/role for platform_admin with valid impersonation header', async () => {
    const fakeFb = makeAdmin({
      uid: 'p-uid', role: 'platform_admin', shop_id: undefined, goldsmith_uid: 'p-id',
      phone_number: undefined,
    });
    const strategy = new FirebaseJwtStrategy(fakeFb as never, undefined);
    const token = signImpersonationToken({
      sessionId: '11111111-1111-1111-1111-111111111111',
      platformUserId: 'p-id',
      targetShopId: '22222222-2222-2222-2222-222222222222',
      ttlSeconds: 1800,
      secret: SECRET,
    });
    const req = { headers: { 'x-impersonation-token': token } } as never;
    const claims = await strategy.validate(req, 'firebase-id-token-blob');
    expect(claims.shop_id).toBe('22222222-2222-2222-2222-222222222222');
    expect(claims.role).toBe('shop_admin');
    expect(claims.impersonationSessionId).toBe('11111111-1111-1111-1111-111111111111');
    expect(claims.impersonatorPlatformUserId).toBe('p-id');
    // goldsmith_uid MUST be the session UUID (not the Firebase UID), so tenant write paths
    // can insert it into UUID columns without type errors.
    expect(claims.goldsmith_uid).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('ignores impersonation header for non-platform-admin tokens', async () => {
    const fakeFb = makeAdmin({
      uid: 'shop-uid', role: 'shop_staff', shop_id: 'shop-X', goldsmith_uid: 'u-id',
      phone_number: '+91999',
    });
    const strategy = new FirebaseJwtStrategy(fakeFb as never, undefined);
    const token = signImpersonationToken({
      sessionId: '11111111-1111-1111-1111-111111111111',
      platformUserId: 'p-id',
      targetShopId: '22222222-2222-2222-2222-222222222222',
      ttlSeconds: 1800,
      secret: SECRET,
    });
    const req = { headers: { 'x-impersonation-token': token } } as never;
    const claims = await strategy.validate(req, 'firebase-id-token-blob');
    expect(claims.shop_id).toBe('shop-X');
    expect(claims.role).toBe('shop_staff');
    expect(claims.impersonationSessionId).toBeUndefined();
  });

  it('platform_admin without impersonation header returns base claims', async () => {
    const fakeFb = makeAdmin({
      uid: 'p-uid', role: 'platform_admin', shop_id: undefined, goldsmith_uid: 'p-id',
      phone_number: undefined,
    });
    const strategy = new FirebaseJwtStrategy(fakeFb as never, undefined);
    const req = { headers: {} } as never;
    const claims = await strategy.validate(req, 'firebase-id-token-blob');
    expect(claims.role).toBe('platform_admin');
    expect(claims.shop_id).toBeUndefined();
    expect(claims.impersonationSessionId).toBeUndefined();
  });

  it('rejects with 401 when impersonation token is malformed', async () => {
    const fakeFb = makeAdmin({
      uid: 'p-uid', role: 'platform_admin', shop_id: undefined, goldsmith_uid: 'p-id',
      phone_number: undefined,
    });
    const strategy = new FirebaseJwtStrategy(fakeFb as never, undefined);
    const req = { headers: { 'x-impersonation-token': 'not-a-jwt' } } as never;
    await expect(strategy.validate(req, 'firebase-id-token-blob')).rejects.toMatchObject({
      response: { code: 'auth.impersonation_token_invalid' },
    });
  });

  it('rejects with 401 when IMPERSONATION_JWT_SECRET is unset', async () => {
    delete process.env['IMPERSONATION_JWT_SECRET'];
    const fakeFb = makeAdmin({
      uid: 'p-uid', role: 'platform_admin', shop_id: undefined, goldsmith_uid: 'p-id',
      phone_number: undefined,
    });
    const strategy = new FirebaseJwtStrategy(fakeFb as never, undefined);
    const req = { headers: { 'x-impersonation-token': 'some-token' } } as never;
    await expect(strategy.validate(req, 'firebase-id-token-blob')).rejects.toMatchObject({
      response: { code: 'auth.impersonation_misconfigured' },
    });
  });
});
