import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tenantContext } from '@goldsmith/tenant-context';
import type { ShopUserRole } from '@goldsmith/tenant-context';

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
    const tc = tenantContext.current();
    if (!tc?.authenticated) throw new ForbiddenException({ code: 'auth.not_authenticated' });
    if (!required.includes(tc.role)) throw new ForbiddenException({ code: 'auth.insufficient_role' });
    return true;
  }
}
