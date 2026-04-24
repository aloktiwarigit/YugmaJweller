import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { TenantContextDec } from '@goldsmith/tenant-context';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext, TenantContext } from '@goldsmith/tenant-context';
import { auditLog, AuditAction } from '@goldsmith/audit';
import type { InviteStaffDto, UpdatePermissionDto } from '@goldsmith/shared';
import { InviteStaffSchema, UpdatePermissionSchema } from '@goldsmith/shared';
import { PermissionsCache } from '@goldsmith/tenant-config';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import type { AuditLogDateRange, AuditLogCategory } from './audit-log.repository';
import { PermissionsRepository } from './permissions.repository';
import { PolicyGuard } from './guards/policy.guard';
import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';

type FirebaseRequest = Request & { user?: { uid?: string; phone_number?: string } };

@Controller('/api/v1/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly svc: AuthService,
    @Inject(AuthRepository) private readonly authRepo: AuthRepository,
    @Inject(PermissionsRepository) private readonly permissionsRepo: PermissionsRepository,
    @Inject(PermissionsCache) private readonly permissionsCache: PermissionsCache,
    @Inject('PG_POOL') private readonly pool: import('pg').Pool,
  ) {}

  @Post('/session')
  @HttpCode(200)
  // nosemgrep: goldsmith.skip-tenant-requires-skip-auth -- global FirebaseJwtGuard enforces auth; only tenant resolution is deferred until phone→shop lookup inside the handler
  @SkipTenant()
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async session(@Req() req: Request, @Ip() ip: string) {
    const user = (req as FirebaseRequest).user;
    if (!user?.uid || !user.phone_number) throw new UnauthorizedException({ code: 'auth.missing' });
    return this.svc.session({
      uid: user.uid,
      phoneE164: user.phone_number,
      ip,
      userAgent: String(req.headers['user-agent'] ?? ''),
      requestId: String(req.headers['x-request-id'] ?? ''),
    });
  }

  @TenantWalkerRoute({
    verify: (body, tenant) => {
      const b = body as { tenant?: { id?: string }; user?: { id?: string } } | null;
      if (b?.tenant?.id !== tenant.id) {
        return `cross-tenant leak: tenant ${tenant.id} saw ${b?.tenant?.id}`;
      }
      if (b?.user?.id === '') return 'empty user.id';
      return null;
    },
  })
  @Get('/me')
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async me(@TenantContextDec() ctx: TenantContext) {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const auth = ctx as AuthenticatedTenantContext;
    return {
      user: { id: auth.userId, role: auth.role },
      tenant: { id: auth.tenant.id, slug: auth.tenant.slug, display_name: auth.tenant.display_name },
    };
  }

  @TenantWalkerRoute({ expectedStatus: 201, body: { phone: '+919876543210', role: 'shop_staff', display_name: 'Test Staff' } })
  @Post('/invite')
  @Roles('shop_admin', 'shop_manager')
  @UseGuards(PolicyGuard)
  @UsePipes(new ZodValidationPipe(InviteStaffSchema))
  async invite(
    @Body() dto: InviteStaffDto,
  ): Promise<{ userId: string }> {
    const ctx = tenantContext.requireCurrent();
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const auth = ctx as AuthenticatedTenantContext;
    return this.svc.invite(auth.shopId, dto, auth.userId);
  }

  @TenantWalkerRoute()
  @Get('/users')
  @Roles('shop_admin', 'shop_manager')
  async listUsers(): Promise<Array<{
    id: string; displayName: string; role: string; status: string;
    phone: string; invitedAt: string | null; activatedAt: string | null;
  }>> {
    const ctx = tenantContext.requireCurrent();
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const auth = ctx as AuthenticatedTenantContext;
    return this.authRepo.listUsers(auth.shopId);
  }

  @TenantWalkerRoute({ pathParams: { role: 'shop_manager' } })
  @Get('/roles/:role/permissions')
  @Roles('shop_admin')
  async getPermissions(@Param('role') role: string): Promise<Record<string, boolean>> {
    const ctx = tenantContext.requireCurrent();
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const auth = ctx as AuthenticatedTenantContext;
    return this.permissionsRepo.getPermissions(auth.shopId, role as import('@goldsmith/tenant-context').ShopUserRole);
  }

  @TenantWalkerRoute({ expectedStatus: 200, body: { permission_key: 'billing.create', is_enabled: true }, pathParams: { role: 'shop_manager' } })
  @Put('/roles/:role/permissions')
  @Roles('shop_admin')
  async updatePermission(
    @Param('role') role: string,
    @Body(new ZodValidationPipe(UpdatePermissionSchema)) dto: UpdatePermissionDto,
    @Req() _req: Request,
  ): Promise<void> {
    const ctx = tenantContext.requireCurrent();
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const auth = ctx as AuthenticatedTenantContext;
    const shopId = auth.shopId;
    await this.permissionsRepo.upsertPermission(shopId, role as import('@goldsmith/tenant-context').ShopUserRole, dto.permission_key, dto.is_enabled);
    await this.permissionsCache.invalidate(shopId, role as import('@goldsmith/tenant-context').ShopUserRole);
    await tenantContext.runWith(auth, () =>
      auditLog(this.pool, {
        action: AuditAction.PERMISSIONS_UPDATED,
        subjectType: 'role_permissions',
        actorUserId: auth.userId,
        metadata: { role, permission_key: dto.permission_key, is_enabled: dto.is_enabled },
      }),
    );
  }

  @Get('/audit-log')
  @Roles('shop_admin', 'shop_manager')
  @UseGuards(PolicyGuard)
  async getAuditLog(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('dateRange') dateRange?: AuditLogDateRange,
    @Query('category') category?: AuditLogCategory,
  ): Promise<unknown> {
    const ctx = tenantContext.requireCurrent();
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const auth = ctx as AuthenticatedTenantContext;
    // PolicyGuard only enforces @Permission() keys — not @Roles(). Explicit role check required.
    if (auth.role === 'shop_staff') throw new ForbiddenException({ errorCode: 'auth.permission_denied' });
    const parsedPage = parseInt(page ?? '1', 10);
    const parsedPageSize = parseInt(pageSize ?? '20', 10);
    return this.svc.getAuditLog({
      page: Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1,
      pageSize: Number.isFinite(parsedPageSize) ? Math.min(50, Math.max(1, parsedPageSize)) : 20,
      dateRange,
      category,
    });
  }

  @Get('/audit-log/export')
  @Roles('shop_admin')
  @UseGuards(PolicyGuard)
  auditLogExport(): { status: string; reason: string } {
    return { status: 'deferred', reason: 'Azure subscription not provisioned' };
  }

  @Post('/logout/all')
  @UseGuards(PolicyGuard)
  @HttpCode(204)
  async logoutAll(@Req() req: Request): Promise<void> {
    const user = (req as FirebaseRequest).user;
    if (!user?.uid) throw new UnauthorizedException({ code: 'auth.missing' });
    const ctx = tenantContext.requireCurrent();
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const auth = ctx as AuthenticatedTenantContext;
    await this.svc.logoutAll(auth.userId, user.uid);
  }

  @Delete('/staff/:userId')
  @Roles('shop_admin')
  @HttpCode(204)
  async revokeStaff(@Param('userId', new ParseUUIDPipe()) userId: string): Promise<void> {
    const ctx = tenantContext.requireCurrent();
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const auth = ctx as AuthenticatedTenantContext;
    await this.svc.revokeStaff(auth.shopId, userId, auth.userId);
  }
}
