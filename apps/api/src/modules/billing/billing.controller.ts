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
import { BillingService } from './billing.service';

@Controller('/api/v1/billing')
export class BillingController {
  constructor(private readonly svc: BillingService) {}

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

  @Get('/invoices/:id')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getInvoice(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvoiceResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.getInvoice(id);
  }
}
