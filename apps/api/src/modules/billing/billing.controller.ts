import {
  BadRequestException, Body, Controller, Get, Headers, Inject, Param, Post, Query,
  ParseIntPipe, ParseUUIDPipe, UnauthorizedException, UnprocessableEntityException,
} from '@nestjs/common';
import { ComplianceHardBlockError } from '@goldsmith/compliance';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext, AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { CreateInvoiceSchema, RecordCashPaymentSchema } from '@goldsmith/shared';
import type { CreateInvoiceDtoType, InvoiceResponse, RecordCashPaymentDto } from '@goldsmith/shared';
import type { CashPaymentResult, ManualPaymentDto, Payment } from './payment.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TenantWalkerRoute } from '../../common/decorators/tenant-walker-route.decorator';
import { BillingService } from './billing.service';
import { EstimateService } from './estimate.service';
import type { CreateEstimateInput, EstimateResponse } from './estimate.service';
import { PaymentService } from './payment.service';
import { VoidService } from './void.service';
import type { CreditNoteResponse } from './void.service';
import { ShareService } from './share.service';
import type { ShareWhatsAppResult } from './share.service';
import { GstrExportService } from './gstr-export.service';
import type { GstrType } from './gstr-export.service';
import { UrdService } from './urd.service';
import type { RecordUrdPurchaseDto, UrdPurchaseResponse } from './urd.service';

@Controller('/api/v1/billing')
export class BillingController {
  constructor(
    @Inject(BillingService)    private readonly svc: BillingService,
    @Inject(EstimateService)   private readonly estimates: EstimateService,
    @Inject(PaymentService)    private readonly payments: PaymentService,
    @Inject(VoidService)       private readonly voids: VoidService,
    @Inject(ShareService)      private readonly share: ShareService,
    @Inject(GstrExportService) private readonly gstr: GstrExportService,
    @Inject(UrdService)        private readonly urd: UrdService,
  ) {}

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

  // Section 269ST cash-cap: all roles can attempt a cash payment; STAFF cannot use override.
  // Idempotency-Key header is required — retries with the same key are safe (idempotent).
  // Returns 422 ComplianceHardBlockError when daily cash would exceed Rs 1,99,999 and no override.
  @TenantWalkerRoute({ expectedStatus: 400, pathParams: { id: '00000000-0000-0000-0000-000000000001' } })
  @Post('/invoices/:id/payments/cash')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async recordCashPayment(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) invoiceId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body(new ZodValidationPipe(RecordCashPaymentSchema)) dto: RecordCashPaymentDto,
  ): Promise<CashPaymentResult> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException({ code: 'payment.idempotency_key_required' });
    }
    try {
      return await this.payments.recordCashPayment(
        invoiceId,
        BigInt(dto.amountPaise),
        idempotencyKey,
        dto.override,
      );
    } catch (err) {
      if (err instanceof ComplianceHardBlockError && err.code === 'compliance.pmla_threshold_blocked') {
        throw new UnprocessableEntityException({ code: err.code, ...err.meta });
      }
      throw err;
    }
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

  // Void invoice within 24h of issuance. OWNER only.
  // Returns 422 if outside window (use credit-note instead) or not ISSUED.
  // Returns 403 if caller is not OWNER.
  @TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-0000-0000-000000000000' } })
  @Post('/invoices/:id/void')
  @Roles('shop_admin')
  async voidInvoice(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason?: string } | undefined,
  ): Promise<InvoiceResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    await this.voids.voidInvoice(
      { userId: ctx.userId, role: ctx.role, shopId: ctx.shopId },
      id,
      { reason: dto?.reason ?? '' },
    );
    return this.svc.getInvoice(id);
  }

  // Issue a credit note when invoice is older than 24h. OWNER only.
  // Returns 409 if a credit note already exists for this invoice.
  // Returns 409 if invoice is still within the void window (use void endpoint instead).
  @TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-0000-0000-000000000000' } })
  @Post('/invoices/:id/credit-note')
  @Roles('shop_admin')
  async issueCreditNote(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason?: string } | undefined,
  ): Promise<CreditNoteResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.voids.issueCreditNote(
      { userId: ctx.userId, role: ctx.role, shopId: ctx.shopId },
      id,
      { reason: dto?.reason ?? '' },
    );
  }

  @TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-0000-0000-000000000000' } })
  @Post('/invoices/:id/share/whatsapp')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async shareWhatsApp(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShareWhatsAppResult> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.share.shareInvoiceWhatsApp(id);
  }

  // ── Estimate endpoints (FR41 + FR42) ──────────────────────────────────────

  @TenantWalkerRoute({
    expectedStatus: 400,
    body: { lineItems: [], goldRatePaisePerGram: '684200', subtotalPaise: '0', gstPaise: '0', totalPaise: '0' },
  })
  @Post('/estimates')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async createEstimate(
    @TenantContextDec() ctx: TenantContext,
    @Body() dto: CreateEstimateInput,
  ): Promise<EstimateResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!dto.totalPaise || dto.totalPaise <= 0n) {
      throw new BadRequestException({ code: 'estimate.total_must_be_positive' });
    }
    return this.estimates.createEstimate(dto);
  }

  @TenantWalkerRoute()
  @Get('/estimates')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listEstimates(
    @TenantContextDec() ctx: TenantContext,
    @Query('page',     new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ): Promise<EstimateResponse[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const limit  = Math.min(Math.max(pageSize ?? 20, 1), 100);
    const offset = (Math.max(page ?? 1, 1) - 1) * limit;
    return this.estimates.listEstimates(ctx.shopId, limit, offset);
  }

  @TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-0000-0000-000000000000' } })
  @Get('/estimates/:id')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getEstimate(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EstimateResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.estimates.getEstimate(id, ctx.shopId);
  }

  @TenantWalkerRoute({ expectedStatus: 400, pathParams: { id: '00000000-0000-0000-0000-000000000000' } })
  @Post('/estimates/:id/convert')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async convertEstimate(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey: string,
  ): Promise<InvoiceResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException({ code: 'invoice.idempotency_key_required' });
    }
    try {
      return await this.svc.convertEstimateToInvoice(id, idempotencyKey);
    } catch (err) {
      if (err instanceof ComplianceHardBlockError) {
        throw new UnprocessableEntityException({ code: err.code, ...err.meta });
      }
      throw err;
    }
  }

  // ── Compliance GSTR ───────────────────────────────────────────────────────

  @TenantWalkerRoute({ expectedStatus: 400 })
  @Get('/compliance/gstr')
  @Roles('shop_admin')
  async exportGstr(
    @TenantContextDec() ctx: TenantContext,
    @Query('month') month: string,
    @Query('type') type: GstrType,
  ): Promise<{ csv: string; filename: string }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!month) throw new BadRequestException({ code: 'gstr.month_required' });
    if (type !== 'gstr1' && type !== 'gstr3b') {
      throw new BadRequestException({ code: 'gstr.invalid_type' });
    }
    const csv = type === 'gstr1'
      ? await this.gstr.generateGstr1Csv(month)
      : await this.gstr.generateGstr3bSummary(month);
    return { csv, filename: `${type}-${month}.csv` };
  }

  @Post('/invoices/:id/payments/upi')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async initiateUpiPayment(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: { amountPaise: string }): Promise<{ orderId: string }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!dto.amountPaise) throw new BadRequestException({ code: 'payment.amount_required' });
    return this.payments.initiateUpiPayment(ctx as AuthenticatedTenantContext, id, BigInt(dto.amountPaise));
  }

  @Post('/invoices/:id/payments/manual')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async recordManualPayment(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: { method: ManualPaymentDto['method']; amountPaise: string; referenceNumber?: string }): Promise<Payment> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    if (!dto.method || !dto.amountPaise) throw new BadRequestException({ code: 'payment.fields_required' });
    const validMethods: ManualPaymentDto['method'][] = ['CARD', 'NET_BANKING', 'OLD_GOLD', 'SCHEME'];
    if (!validMethods.includes(dto.method)) throw new UnprocessableEntityException({ code: 'payment.invalid_method' });
    return this.payments.recordManualPayment(ctx as AuthenticatedTenantContext, id, { method: dto.method, amountPaise: BigInt(dto.amountPaise), referenceNumber: dto.referenceNumber });
  }

  @Get('/invoices/:id/payments')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listPayments(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<Payment[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.payments.listPayments(id);
  }

  @TenantWalkerRoute({ expectedStatus: 400 })
  @Post('/urd-purchases')
  @Roles('shop_admin', 'shop_manager')
  async recordUrdPurchase(
    @TenantContextDec() ctx: TenantContext,
    @Body() dto: RecordUrdPurchaseDto,
  ): Promise<UrdPurchaseResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.urd.recordUrdPurchase(ctx as AuthenticatedTenantContext, dto);
  }

  @TenantWalkerRoute()
  @Get('/urd-purchases')
  @Roles('shop_admin', 'shop_manager')
  async listUrdPurchases(@TenantContextDec() ctx: TenantContext): Promise<UrdPurchaseResponse[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.urd.listUrdPurchases(ctx as AuthenticatedTenantContext);
  }

  @TenantWalkerRoute({ expectedStatus: 404, pathParams: { id: '00000000-0000-0000-0000-000000000000', purchaseId: '00000000-0000-0000-0000-000000000000' } })
  @Post('/invoices/:id/urd-apply/:purchaseId')
  @Roles('shop_admin', 'shop_manager')
  async applyUrdToInvoice(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) invoiceId: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
  ): Promise<void> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    await this.urd.applyUrdToInvoice(ctx as AuthenticatedTenantContext, purchaseId, invoiceId);
  }
}
