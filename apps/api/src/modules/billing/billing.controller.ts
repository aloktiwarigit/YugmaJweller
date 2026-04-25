import {
  Body, Controller, Get, Headers, Param, Post, Query,
  ParseIntPipe, ParseUUIDPipe, UnauthorizedException,
} from '@nestjs/common';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { CreateInvoiceSchema } from '@goldsmith/shared';
import type { CreateInvoiceDtoType, InvoiceResponse } from '@goldsmith/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';
import { BillingService } from './billing.service';

@Controller('/api/v1/billing')
export class BillingController {
  constructor(private readonly svc: BillingService) {}

  // Walker: missing idempotency-key header → service throws 400 BadRequest.
  // This is the expected status — it proves auth/RLS succeeded (not 401/403/500)
  // and that the missing-header validation fires, confirming the endpoint is
  // tenant-scoped and reachable. A body with valid shape is still provided so
  // ZodValidationPipe passes before the service-layer check.
  @TenantWalkerRoute({
    expectedStatus: 400,
    body: {
      customerName: 'Walker Probe',
      lines: [{
        description: 'Walker probe line',
        metalType: 'GOLD',
        purity: '22K',
        netWeightG: '1.0000',
        makingChargePct: '12.00',
        stoneChargesPaise: '0',
        hallmarkFeePaise: '0',
      }],
    },
  })
  @Post('/invoices')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async createInvoice(
    @TenantContextDec() ctx: TenantContext,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body(new ZodValidationPipe(CreateInvoiceSchema)) dto: CreateInvoiceDtoType,
  ): Promise<InvoiceResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.createInvoice(dto, idempotencyKey ?? '');
  }

  @TenantWalkerRoute()
  @Get('/invoices')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listInvoices(
    @TenantContextDec() ctx: TenantContext,
    @Query('page',     new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ): Promise<InvoiceResponse[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.listInvoices(page, pageSize);
  }

  // Walker: a nil UUID will never match any invoice row (RLS hides cross-tenant
  // rows and the row simply doesn't exist) → NotFoundException → 404.
  // This confirms RLS is active: a cross-tenant leak would return 200.
  @TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-0000-0000-000000000000' } })
  @Get('/invoices/:id')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getInvoice(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvoiceResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.getInvoice(id);
  }

  // Tax-audit PAN decryption — OWNER only, rate-limited 10 req/hr per shop.
  // PAN is never included in audit log; only access timestamp + actor.
  @TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-0000-0000-000000000000' } })
  @Get('/invoices/:id/pan-decrypt')
  @Roles('shop_admin')
  async decryptPan(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ pan: string }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.decryptInvoicePan(id);
  }
}
