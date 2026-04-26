import {
  Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UnauthorizedException,
} from '@nestjs/common';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { AdjustPointsBodySchema } from '@goldsmith/shared';
import type { AdjustPointsBody, LoyaltyState, LoyaltyTransaction } from '@goldsmith/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';
import { LoyaltyService } from './loyalty.service';

@Controller('/api/v1/loyalty')
export class LoyaltyController {
  constructor(private readonly svc: LoyaltyService) {}

  // Walker: a nil UUID will never match any customer row (RLS hides cross-tenant
  // rows and the row simply doesn't exist) → NotFoundException → 404.
  @TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-0000-0000-000000000000' } })
  @Get('customers/:id')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getLoyaltyState(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LoyaltyState> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.getLoyaltyState(id);
  }

  @TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-0000-0000-000000000000' } })
  @Get('customers/:id/transactions')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getRecentTransactions(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<LoyaltyTransaction[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.getRecentTransactions(id, limit ?? 10);
  }

  // Manual points adjustment — OWNER (shop_admin) only.
  // Use cases: goodwill bonus, complaint compensation, mistake correction.
  @TenantWalkerRoute({
    expectedStatus: 404,
    pathParams: { id: '00000000-0000-0000-0000-000000000000' },
    body: { pointsDelta: 10, reason: 'walker probe' },
  })
  @Post('customers/:id/adjust')
  @Roles('shop_admin')
  async adjustPoints(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdjustPointsBodySchema)) dto: AdjustPointsBody,
  ): Promise<{ pointsDelta: number; newBalance: number }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.adjustPoints(id, dto);
  }
}
