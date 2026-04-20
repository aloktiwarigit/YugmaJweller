import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tenantContext } from '@goldsmith/tenant-context';
import type { PermissionsCache } from '@goldsmith/tenant-config';
import { PERMISSION_KEY } from '../../../common/decorators/permission.decorator';
import type { PermissionsRepository } from '../permissions.repository';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsCache: PermissionsCache,
    private readonly permissionsRepo: PermissionsRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredKey = this.reflector.get<string | undefined>(PERMISSION_KEY, ctx.getHandler());
    if (!requiredKey) return true;

    const tc = tenantContext.current();
    if (!tc?.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (tc.role === 'shop_admin') return true;

    let perms = await this.permissionsCache.getPermissions(tc.shopId, tc.role);
    if (!perms) {
      perms = await this.permissionsRepo.getPermissions(tc.shopId, tc.role);
      await this.permissionsCache.setPermissions(tc.shopId, tc.role, perms);
    }

    if (!(perms[requiredKey] ?? false)) {
      throw new ForbiddenException({ errorCode: 'auth.permission_denied', permissionKey: requiredKey });
    }
    return true;
  }
}
