import jwt from 'jsonwebtoken';

export class ImpersonationTokenError extends Error {
  constructor(public readonly reason: 'expired' | 'invalid_signature' | 'malformed' | 'wrong_issuer' | 'missing_claim') {
    super(`impersonation_token.${reason}`);
    this.name = 'ImpersonationTokenError';
  }
}

export interface ImpersonationTokenClaims {
  jti: string;
  sub: string;
  target_shop_id: string;
  iss: 'goldsmith-platform-admin';
  iat: number;
  exp: number;
}

export interface SignArgs {
  sessionId: string;
  platformUserId: string;
  targetShopId: string;
  ttlSeconds: number;
  secret: string;
}

const ISSUER = 'goldsmith-platform-admin';

export function signImpersonationToken(a: SignArgs): string {
  return jwt.sign(
    { sub: a.platformUserId, target_shop_id: a.targetShopId, iss: ISSUER },
    a.secret,
    { algorithm: 'HS256', expiresIn: a.ttlSeconds, jwtid: a.sessionId },
  );
}

export function verifyImpersonationToken(token: string, secret: string): ImpersonationTokenClaims {
  let decoded: jwt.JwtPayload | string;
  try {
    decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'TokenExpiredError') throw new ImpersonationTokenError('expired');
    if (name === 'JsonWebTokenError') throw new ImpersonationTokenError('invalid_signature');
    throw new ImpersonationTokenError('malformed');
  }
  if (typeof decoded === 'string') throw new ImpersonationTokenError('malformed');
  if (decoded.iss !== ISSUER) throw new ImpersonationTokenError('wrong_issuer');
  if (!decoded.jti || !decoded.sub || !decoded['target_shop_id'] || !decoded.exp || !decoded.iat) {
    throw new ImpersonationTokenError('missing_claim');
  }
  return {
    jti: decoded.jti,
    sub: decoded.sub as string,
    target_shop_id: decoded['target_shop_id'] as string,
    iss: ISSUER,
    iat: decoded.iat,
    exp: decoded.exp,
  };
}
