import { Controller, Get, Param, ParseUUIDPipe, UnauthorizedException } from '@nestjs/common';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import type { ViewSummary } from './analytics.service';

export interface MultiPeriodViewSummary {
  '30d': ViewSummary;
  '90d': ViewSummary;
  '365d': ViewSummary;
}

@Controller('/api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('products/:id/views')
  @Roles('shop_admin', 'shop_manager')
  async getProductViews(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @TenantContextDec() ctx: TenantContext,
  ): Promise<MultiPeriodViewSummary> {
    if (!ctx.authenticated) {
      throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    }
    const shopId = ctx.shopId;

    const [d30, d90, d365] = await Promise.all([
      this.svc.getProductViewSummary({ shopId, productId, days: 30 }),
      this.svc.getProductViewSummary({ shopId, productId, days: 90 }),
      this.svc.getProductViewSummary({ shopId, productId, days: 365 }),
    ]);

    return { '30d': d30, '90d': d90, '365d': d365 };
  }
}
