import { Inject, Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import type admin from 'firebase-admin';
import type { Pool } from 'pg';
import { platformAuditLog, AuditAction } from '@goldsmith/audit';
import { FirebaseAdminProvider } from './firebase-admin.provider';

export interface FirebaseUserClaims {
  uid: string;
  phone_number: string | undefined;
  shop_id?: string;
  role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
  goldsmith_uid?: string;  // DB UUID propagated via custom claim; undefined on very first /session call
}

type AdminLike = FirebaseAdminProvider | admin.app.App;

@Injectable()
export class FirebaseJwtStrategy extends PassportStrategy(BearerStrategy, 'firebase-jwt') {
  private readonly logger = new Logger(FirebaseJwtStrategy.name);

  constructor(
    @Inject(FirebaseAdminProvider) private readonly provider: AdminLike,
    @Inject('PG_POOL') @Optional() private readonly pool?: Pool,
  ) { super(); }

  async validate(token: string): Promise<FirebaseUserClaims> {
    try {
      const authInstance =
        'admin' in this.provider && typeof (this.provider as FirebaseAdminProvider).admin === 'function'
          ? (this.provider as FirebaseAdminProvider).admin().auth()
          : (this.provider as admin.app.App).auth();
      const decoded = await authInstance.verifyIdToken(token, true);
      return {
        uid: decoded.uid,
        phone_number: (decoded['phone_number'] ?? decoded['phoneNumber']) as string | undefined,
        shop_id: decoded['shop_id'] as string | undefined,
        role: decoded['role'] as FirebaseUserClaims['role'],
        goldsmith_uid: decoded['goldsmith_uid'] as string | undefined,
      };
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
  }
}
