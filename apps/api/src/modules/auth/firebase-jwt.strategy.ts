import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import type admin from 'firebase-admin';
import { FirebaseAdminProvider } from './firebase-admin.provider';

export interface FirebaseUserClaims {
  uid: string;
  phone_number: string;
  shop_id?: string;
  role?: 'shop_admin' | 'shop_manager' | 'shop_staff' | 'platform_admin';
  user_id?: string;  // DB UUID propagated via custom claim; undefined on very first /session call
}

type AdminLike = FirebaseAdminProvider | admin.app.App;

@Injectable()
export class FirebaseJwtStrategy extends PassportStrategy(BearerStrategy, 'firebase-jwt') {
  constructor(@Inject(FirebaseAdminProvider) private readonly provider: AdminLike) { super(); }

  async validate(token: string): Promise<FirebaseUserClaims> {
    try {
      const authInstance =
        'admin' in this.provider && typeof (this.provider as FirebaseAdminProvider).admin === 'function'
          ? (this.provider as FirebaseAdminProvider).admin().auth()
          : (this.provider as admin.app.App).auth();
      const decoded = await authInstance.verifyIdToken(token, true);
      return {
        uid: decoded.uid,
        phone_number: (decoded['phone_number'] ?? decoded['phoneNumber']) as string,
        shop_id: decoded['shop_id'] as string | undefined,
        role: decoded['role'] as FirebaseUserClaims['role'],
        user_id: decoded['user_id'] as string | undefined,
      };
    } catch (err) {
      // Log the internal cause server-side; do NOT expose SDK validation details in the HTTP response.
      const msg = err instanceof Error ? err.message : String(err);
      void msg; // consumed by GlobalExceptionFilter logger via the thrown exception's stack
      throw new UnauthorizedException({ code: 'auth.token_invalid' });
    }
  }
}
