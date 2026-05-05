import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import type {
  DailySummaryResult, OutstandingResult, CustomerLtvItem, LoyaltySummaryResult,
  StockAgingResult,
} from './reports.service';

@Controller('/api/v1/reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @TenantWalkerRoute({ expectedStatus: 400 })
  @Get('/daily-summary')
  @Roles('shop_admin', 'shop_manager')
  getDailySummary(
    @Query('date') date?: string,
  ): Promise<DailySummaryResult> {
    // Use IST (UTC+5:30) for the default date so it matches the SQL's Asia/Kolkata grouping.
    // new Date().toISOString() would return the UTC date, which is the previous calendar day
    // for Indian users between midnight and 05:29 IST.
    const target = date ?? new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return this.svc.getDailySummary(target);
  }

  @TenantWalkerRoute({ expectedStatus: 200 })
  @Get('/outstanding')
  @Roles('shop_admin', 'shop_manager')
  getOutstanding(
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<OutstandingResult> {
    return this.svc.getOutstanding(page, limit);
  }

  @TenantWalkerRoute({ expectedStatus: 200 })
  @Get('/customer-ltv')
  @Roles('shop_admin', 'shop_manager')
  getCustomerLtv(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<CustomerLtvItem[]> {
    return this.svc.getCustomerLtv(limit);
  }

  @TenantWalkerRoute({ expectedStatus: 200 })
  @Get('/loyalty-summary')
  @Roles('shop_admin', 'shop_manager')
  getLoyaltySummary(): Promise<LoyaltySummaryResult> {
    return this.svc.getLoyaltySummary();
  }

  @TenantWalkerRoute({ expectedStatus: 200 })
  @Get('/stock-aging')
  @Roles('shop_admin', 'shop_manager')
  getStockAging(): Promise<StockAgingResult> {
    return this.svc.getStockAging();
  }
}
