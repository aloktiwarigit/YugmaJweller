import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import type { CtrDocument } from '@goldsmith/compliance';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';
import { ComplianceReportsService } from './compliance-reports.service';

@Controller('/api/v1/billing')
export class ComplianceReportsController {
  constructor(private readonly reports: ComplianceReportsService) {}

  // GET /api/v1/billing/compliance/ctr?customerId=&month=YYYY-MM  OR
  // GET /api/v1/billing/compliance/ctr?customerPhone=&month=YYYY-MM
  // OWNER only. Fetches PMLA aggregates + cash invoices, decrypts PAN for OWNER, returns CTR.
  // Audit: CTR_ACCESSED logged with customer identity + month (no PAN in audit).
  @TenantWalkerRoute({ expectedStatus: 400 })
  @Get('/compliance/ctr')
  @Roles('shop_admin')
  async getCtrReport(
    @TenantContextDec() ctx: TenantContext,
    @Query('customerId')    customerId?: string,
    @Query('customerPhone') customerPhone?: string,
    @Query('month')         month?: string,
  ): Promise<{ text: string; document: CtrDocument }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!month) throw new UnauthorizedException({ code: 'ctr.month_required' });
    return this.reports.getCtrReport(
      customerId ?? null,
      customerPhone ?? null,
      month,
    );
  }
}
