import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { ShopUserRole } from '@goldsmith/tenant-context';
import type { FirebaseUserClaims } from '../../modules/auth/firebase-jwt.strategy';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<ShopUserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    // Read role from req.user (populated by FirebaseJwtGuard which runs before this guard
    // in the APP_GUARD chain). tenantContext is set later by APP_INTERCEPTOR and is NOT
    // available at guard time — do NOT read from tenantContext here.
    const req = ctx.switchToHttp().getRequest<Request & { user?: FirebaseUserClaims }>();
    const role = req.user?.role as ShopUserRole | undefined;
    if (!role) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!required.includes(role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
    return true;
  }
}
