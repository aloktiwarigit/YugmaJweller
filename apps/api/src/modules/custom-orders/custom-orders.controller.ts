import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  InternalServerErrorException,
  Logger,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import type { PaymentsPort } from '@goldsmith/integrations-payments';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CustomOrdersService, ComplianceHardBlockError } from './custom-orders.service';
import type {
  CreateOrderDto,
  CreateDepositOrderDto,
  AddMilestoneDto,
  CustomOrderResponse,
  MilestoneResponse,
} from './custom-orders.service';
import { BillingService } from '../billing/billing.service';

const CreateOrderSchema = z.object({
  customerId:            z.string().uuid().optional(),
  description:           z.string().min(1, 'Description required').max(2000),
  designReferenceUrl:    z.string().url().optional(),
  quotedAmountPaise:     z.string().regex(/^\d+$/).transform(BigInt).optional(),
  estimatedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const CreateDepositSchema = z.object({
  depositAmountPaise: z.string().regex(/^\d+$/).transform(BigInt),
  paymentMethod:      z.enum(['cash', 'razorpay']),
});

const RecordCashDepositSchema = z.object({
  amountPaise: z.string().regex(/^\d+$/).transform(BigInt),
});

const AddMilestoneSchema = z.object({
  title:    z.string().min(1, 'Title required').max(200),
  note:     z.string().max(2000).optional(),
  photoUrl: z.string().url().optional(),
});

const PresignSchema = z.object({
  filename: z.string().min(1).max(200),
});

@Controller('/api/v1/custom-orders')
export class CustomOrdersController {
  private readonly logger = new Logger(CustomOrdersController.name);

  constructor(
    @Inject(CustomOrdersService) private readonly svc: CustomOrdersService,
    @Inject(BillingService)      private readonly billing: BillingService,
    @Inject('PAYMENTS_ADAPTER')  private readonly paymentsAdapter: PaymentsPort,
  ) {}

  @Post()
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async createOrder(
    @TenantContextDec() ctx: TenantContext,
    @Body(new ZodValidationPipe(CreateOrderSchema)) dto: CreateOrderDto,
  ): Promise<CustomOrderResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.createOrder(dto);
  }

  @Get()
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listOrders(
    @TenantContextDec() ctx: TenantContext,
    @Query('limit',  new ParseIntPipe({ optional: true })) limit  = 20,
    @Query('offset', new ParseIntPipe({ optional: true })) offset = 0,
  ): Promise<{ orders: CustomOrderResponse[]; total: number }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.list({ limit: Math.min(limit, 100), offset });
  }

  @Get(':id')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getOrder(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomOrderResponse & { milestones: MilestoneResponse[] }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.getById(id);
  }

  @Post(':id/deposit')
  @Roles('shop_admin', 'shop_manager')
  async createDeposit(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateDepositSchema)) dto: CreateDepositOrderDto,
  ): Promise<CustomOrderResponse & { razorpayKeyId?: string }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    try {
      return await this.svc.createDepositOrder(id, dto);
    } catch (err) {
      if (err instanceof ComplianceHardBlockError) {
        throw new UnprocessableEntityException({ code: err.code, ...err.meta });
      }
      throw err;
    }
  }

  @Post(':id/deposit/cash')
  @Roles('shop_admin', 'shop_manager')
  async recordCashDeposit(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RecordCashDepositSchema)) body: { amountPaise: bigint },
  ): Promise<CustomOrderResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    try {
      return await this.svc.recordCashDeposit(id, body.amountPaise);
    } catch (err) {
      if (err instanceof ComplianceHardBlockError) {
        throw new UnprocessableEntityException({ code: err.code, ...err.meta });
      }
      throw err;
    }
  }

  @Post(':id/milestones')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async addMilestone(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AddMilestoneSchema)) dto: AddMilestoneDto,
  ): Promise<MilestoneResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.addMilestone(id, dto);
  }

  @Patch(':id/ready')
  @Roles('shop_admin', 'shop_manager')
  async markReady(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomOrderResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.markReady(id);
  }

  @Post(':id/convert-to-invoice')
  @Roles('shop_admin', 'shop_manager')
  async convertToInvoice(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ invoiceId: string; orderId: string; status: string }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    const result = await this.billing.convertCustomOrderToInvoice(id, ctx.shopId);
    return { invoiceId: result.invoiceId, orderId: result.order.id, status: result.order.status };
  }

  @Post(':id/presign-upload')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getPresignedUpload(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PresignSchema)) body: { filename: string },
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.getPresignedUploadUrl(id, body.filename);
  }

  // ─── Razorpay Webhook (for custom order deposits) ────────────────────────────
  // This endpoint mirrors /webhooks/razorpay but handles only custom_order_deposit notes.
  // The main razorpay webhook controller (WebhooksModule) handles invoice payments.
  @Post('webhook/razorpay')
  @SkipAuth()
  @SkipTenant()
  async handleRazorpayWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<{ status: 'ok' }> {
    if (!req.rawBody) {
      throw new InternalServerErrorException({ code: 'webhook.raw_body_unavailable' });
    }
    const rawBody = req.rawBody.toString('utf8');

    if (!signature) {
      throw new UnauthorizedException({ code: 'webhook.missing_signature' });
    }

    const valid = this.paymentsAdapter.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      this.logger.warn('Custom order Razorpay webhook signature mismatch');
      throw new UnauthorizedException({ code: 'webhook.invalid_signature' });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException({ code: 'webhook.invalid_json' });
    }

    const event = typeof payload['event'] === 'string' ? payload['event'] : 'unknown';
    if (event !== 'payment.captured') return { status: 'ok' };

    const paymentEntity = (payload['payload'] as Record<string, unknown> | undefined)?.['payment'] as Record<string, unknown> | undefined;
    const entity        = paymentEntity?.['entity'] as Record<string, unknown> | undefined;
    const razorpayPaymentId = typeof entity?.['id'] === 'string' ? entity['id'] : '';
    const notes         = (entity?.['notes'] as Record<string, string> | undefined) ?? {};
    const customOrderId = notes['customOrderId'] ?? '';
    const shopIdHint    = notes['shopId'] ?? '';

    if (!razorpayPaymentId || !customOrderId || notes['type'] !== 'custom_order_deposit') {
      return { status: 'ok' };
    }

    try {
      await this.svc.handleRazorpayWebhook(customOrderId, razorpayPaymentId, shopIdHint);
    } catch (err) {
      this.logger.error({ customOrderId, razorpayPaymentId, err }, 'Custom order webhook processing failed');
    }

    return { status: 'ok' };
  }
}
