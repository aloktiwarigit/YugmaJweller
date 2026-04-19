import { Body, Controller, Get, HttpCode, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext, TenantContext } from '@goldsmith/tenant-context';
import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';
import { StaffService } from './staff.service';
import { InviteStaffDto } from './dto/invite-staff.dto';

@Controller('/api/v1/staff')
export class StaffController {
  constructor(@Inject(StaffService) private readonly svc: StaffService) {}

  @Post()
  @HttpCode(201)
  @TenantWalkerRoute()
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async invite(@Body() dto: InviteStaffDto, @TenantContextDec() ctx: TenantContext) {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.invite(dto, ctx as AuthenticatedTenantContext);
  }

  @Get()
  @TenantWalkerRoute()
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async list(@TenantContextDec() ctx: TenantContext) {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.list(ctx as AuthenticatedTenantContext);
  }
}
