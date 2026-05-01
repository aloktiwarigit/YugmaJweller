import { Inject, Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import type admin from 'firebase-admin';
import type { Pool } from 'pg';
import type { Request } from 'express';
import { platformAuditLog, AuditAction } from '@goldsmith/audit';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import {
  verifyImpersonationToken,
  ImpersonationTokenError,
} from '../platform-admin/impersonation-token';

export interface FirebaseUserClaims {
  uid: string;
  phone_number: string | undefined;
  shop_id?: string;
  role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
  goldsmith_uid?: string;  // DB UUID propagated via custom claim; undefined on very first /session call
  impersonationSessionId?: string;
  impersonatorPlatformUserId?: string;
}

type AdminLike = FirebaseAdminProvider | admin.app.App;

function readHeader(req: Request | undefined, name: string): string | undefined {
  const v = req?.headers?.[name];
  return typeof v === 'string' ? v : undefined;
}

@Injectable()
export class FirebaseJwtStrategy extends PassportStrategy(BearerStrategy, 'firebase-jwt') {
  private readonly logger = new Logger(FirebaseJwtStrategy.name);

  constructor(
    @Inject(FirebaseAdminProvider) private readonly provider: AdminLike,
    @Inject('PG_POOL') @Optional() private readonly pool?: Pool,
  ) {
    super({ passReqToCallback: true });
  }

  async validate(req: Request, token: string): Promise<FirebaseUserClaims> {
    let decoded;
    try {
      const authInstance =
        'admin' in this.provider && typeof (this.provider as FirebaseAdminProvider).admin === 'function'
          ? (this.provider as FirebaseAdminProvider).admin().auth()
          : (this.provider as admin.app.App).auth();
      decoded = await authInstance.verifyIdToken(token, true);
    } catch (err) {
      const firebaseCode = (err as { code?: string })?.code;
      // Log the original Firebase error server-side before throwing (Fix 7)
      this.logger.warn({ firebaseErrorCode: firebaseCode, err }, 'firebase verifyIdToken failed');
      // Fire-and-forget audit for invalid/revoked tokens (Fix 10)
      if (this.pool) {
        void platformAuditLog(this.pool, {
          action: AuditAction.AUTH_TOKEN_INVALID,
          metadata: { firebaseCode },
        }).catch(() => undefined);
      }
      throw new UnauthorizedException({ code: 'auth.token_invalid' });
    }

    const baseClaims: FirebaseUserClaims = {
      uid: decoded.uid,
      phone_number: (decoded['phone_number'] ?? decoded['phoneNumber']) as string | undefined,
      shop_id: decoded['shop_id'] as string | undefined,
      role: decoded['role'] as FirebaseUserClaims['role'],
      goldsmith_uid: decoded['goldsmith_uid'] as string | undefined,
    };

    // Impersonation rewrite — only for platform_admin callers presenting a valid impersonation JWT.
    // Non-platform-admin tokens are returned unchanged regardless of the header (defense against
    // a hostile shop_user trying to forge a token via header injection).
    if (baseClaims.role !== 'platform_admin') return baseClaims;
    const impersonationToken = readHeader(req, 'x-impersonation-token');
    if (!impersonationToken) return baseClaims;

    const secret = process.env['IMPERSONATION_JWT_SECRET'];
    if (!secret) {
      this.logger.error('IMPERSONATION_JWT_SECRET not configured — refusing impersonation');
      throw new UnauthorizedException({ code: 'auth.impersonation_misconfigured' });
    }

    let impClaims;
    try {
      impClaims = verifyImpersonationToken(impersonationToken, secret);
    } catch (err) {
      const reason = err instanceof ImpersonationTokenError ? err.reason : 'unknown';
      this.logger.warn({ reason }, 'impersonation token rejected');
      throw new UnauthorizedException({ code: 'auth.impersonation_token_invalid', reason });
    }

    // The DB-side liveness check (ended_at IS NULL AND expires_at > now()) is performed by the
    // tenant interceptor on every request. Defense in depth: JWT exp and DB row both verified.
    return {
      ...baseClaims,
      shop_id: impClaims.target_shop_id,
      role: 'shop_admin',
      goldsmith_uid: impClaims.sub,
      impersonationSessionId: impClaims.jti,
      impersonatorPlatformUserId: impClaims.sub,
    };
  }
}
