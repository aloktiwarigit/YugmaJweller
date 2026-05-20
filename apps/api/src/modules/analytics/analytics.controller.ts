import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import type { CustomerViewItem, ViewSummary } from './analytics.service';

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

  @Get('customers/:customerId/views')
  @Roles('shop_admin', 'shop_manager')
  async getCustomerViewHistory(
    @Param('customerId', new ParseUUIDPipe()) customerId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @TenantContextDec() ctx: TenantContext,
  ): Promise<CustomerViewItem[]> {
    if (!ctx.authenticated) {
      throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    }
    const safeLimit = Math.min(limit, 20);
    return this.svc.getCustomerViewHistory({ shopId: ctx.shopId, customerId, limit: safeLimit });
  }
}
