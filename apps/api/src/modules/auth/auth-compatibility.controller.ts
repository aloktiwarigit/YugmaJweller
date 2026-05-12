import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Ip,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext, TenantContext } from '@goldsmith/tenant-context';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { AuthService } from './auth.service';
import type { SessionResult } from './auth.service';

type FirebaseRequest = Request & { user?: { uid?: string; phone_number?: string } };
type MeResponse = {
  user: { id: string; role: AuthenticatedTenantContext['role'] };
  tenant: { id: string; slug: string; display_name: string };
};

@Controller('/auth')
export class AuthCompatibilityController {
  constructor(@Inject(AuthService) private readonly svc: AuthService) {}

  @Post('/session')
  @HttpCode(200)
  @SkipTenant()
  async session(@Req() req: Request, @Ip() ip: string): Promise<SessionResult> {
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

  @Get('/me')
  me(@TenantContextDec() ctx: TenantContext): MeResponse {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const auth = ctx as AuthenticatedTenantContext;
    return {
      user: { id: auth.userId, role: auth.role },
      tenant: { id: auth.tenant.id, slug: auth.tenant.slug, display_name: auth.tenant.display_name },
    };
  }
}
