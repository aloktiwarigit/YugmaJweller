import { Body, Controller, ForbiddenException, Get, HttpCode, Inject, Ip, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext, TenantContext } from '@goldsmith/tenant-context';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { AuthService } from './auth.service';
import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';
import type { InviteStaffDto } from './dto/invite-staff.dto';

@Controller('/api/v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly svc: AuthService) {}

  @Post('/session')
  @HttpCode(200)
  // nosemgrep: goldsmith.skip-tenant-requires-skip-auth -- global FirebaseJwtGuard enforces auth; only tenant resolution is deferred until phone→shop lookup inside the handler
  @SkipTenant()
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async session(@Req() req: Request, @Ip() ip: string) {
    const user = (req as Request & { user?: { uid?: string; phone_number?: string } }).user;
    if (!user?.uid || !user.phone_number) throw new UnauthorizedException({ code: 'auth.missing' });
    return this.svc.session({
      uid: user.uid,
      phoneE164: user.phone_number,
      ip,
      userAgent: String(req.headers['user-agent'] ?? ''),
      requestId: String(req.headers['x-request-id'] ?? ''),
    });
  }

  @Get('/me')
  @TenantWalkerRoute()
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async me(@TenantContextDec() ctx: TenantContext) {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const auth = ctx as AuthenticatedTenantContext;
    return {
      user: { id: auth.userId, role: auth.role },
      tenant: { id: auth.tenant.id, slug: auth.tenant.slug, display_name: auth.tenant.display_name },
    };
  }

  @Post('/invite')
  @HttpCode(201)
  @TenantWalkerRoute()
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async inviteStaff(@TenantContextDec() ctx: TenantContext, @Body() body: InviteStaffDto) {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (ctx.role !== 'shop_admin') throw new ForbiddenException({ code: 'auth.insufficient_role' });
    return this.svc.invite({ phone: body.phone, role: body.role });
  }

  @Get('/staff')
  @TenantWalkerRoute()
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async listStaff(@TenantContextDec() ctx: TenantContext) {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (ctx.role !== 'shop_admin' && ctx.role !== 'shop_manager') {
      throw new ForbiddenException({ code: 'auth.insufficient_role' });
    }
    return this.svc.listStaff();
  }
}
