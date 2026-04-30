import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsPort } from '@goldsmith/integrations-payments';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { RateLockBookingsService } from './rate-lock-bookings.service';

interface CreateBookingDto {
  customerId:         string;
  depositAmountPaise: string;
}

@Controller('/api/v1/rate-lock/bookings')
export class RateLockBookingsController {
  private readonly logger = new Logger(RateLockBookingsController.name);

  constructor(
    @Inject(RateLockBookingsService)      private readonly svc: RateLockBookingsService,
    @Inject('RATE_LOCK_PAYMENTS_ADAPTER') private readonly paymentsAdapter: PaymentsPort,
  ) {}

  @Post()
  @Roles('shop_admin', 'shop_manager')
  async createBooking(@Body() body: CreateBookingDto): Promise<unknown> {
    return this.svc.createBooking({
      customerId:         body.customerId,
      depositAmountPaise: BigInt(body.depositAmountPaise),
    });
  }

  @Get()
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listBookings(
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ): Promise<unknown> {
    return this.svc.listBookings({ customerId, status });
  }

  @Get(':id')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getBooking(@Param('id') id: string): Promise<unknown> {
    return this.svc.getBooking(id);
  }

  @Post('webhook/razorpay')
  @SkipAuth()
  @SkipTenant()
  async handleRazorpayWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<{ status: 'ok' }> {
    if (!req.rawBody) {
      this.logger.error('rawBody unavailable — NestJS rawBody:true not configured');
      throw new InternalServerErrorException({ code: 'webhook.raw_body_unavailable' });
    }
    const rawBody = req.rawBody.toString('utf8');

    if (!signature) {
      throw new UnauthorizedException({ code: 'webhook.missing_signature' });
    }

    const valid = this.paymentsAdapter.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      this.logger.warn('Rate-lock Razorpay webhook signature mismatch');
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
    const bookingId     = notes['bookingId']  ?? '';
    const shopIdHint    = notes['shopId']     ?? '';

    if (!razorpayPaymentId || !bookingId || notes['type'] !== 'rate_lock_deposit') {
      return { status: 'ok' };
    }

    try {
      await this.svc.handleWebhookPayment(bookingId, razorpayPaymentId, shopIdHint);
    } catch (err) {
      this.logger.error({ bookingId, razorpayPaymentId, err }, 'Rate-lock webhook processing failed');
      // Re-throw so Razorpay receives a non-200 response and will retry delivery.
      // Swallowing the error here would leave the booking in PENDING_PAYMENT permanently
      // while Razorpay believes the webhook was successfully processed.
      throw new InternalServerErrorException({ code: 'rate_lock.webhook_processing_failed' });
    }

    return { status: 'ok' };
  }
}
