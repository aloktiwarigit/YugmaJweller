import {
  Controller,
  Headers,
  Inject,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Request } from 'express';
import type { Queue } from '@goldsmith/queue';
import type { PaymentsPort } from '@goldsmith/integrations-payments';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';

export interface RazorpayWebhookJob {
  event: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  // shopId is NOT trusted from the webhook payload — it is resolved from the
  // payments table in confirmWebhookPayment using razorpay_order_id.
  // Kept here for logging/debugging only.
  shopIdHint: string;
  rawPayload: string;
}

@Controller('/webhooks/razorpay')
@SkipAuth()
@SkipTenant()
export class RazorpayWebhookController {
  private readonly logger = new Logger(RazorpayWebhookController.name);

  constructor(
    @Inject('PAYMENTS_ADAPTER') private readonly paymentsAdapter: PaymentsPort,
    @InjectQueue('razorpay-webhooks') private readonly webhookQueue: Queue,
  ) {}

  @Post()
  async handleRazorpayWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<{ status: 'ok' }> {
    // Security: rawBody must be available; JSON.stringify(req.body) is NOT a valid
    // substitute because re-serialization changes byte layout, breaking the HMAC.
    if (!req.rawBody) {
      this.logger.error('rawBody is undefined — NestJS rawBody:true not configured or middleware stripped it');
      throw new InternalServerErrorException({ code: 'webhook.raw_body_unavailable' });
    }
    const rawBody = req.rawBody.toString('utf8');

    if (!signature) {
      throw new UnauthorizedException({ code: 'webhook.missing_signature' });
    }

    const valid = this.paymentsAdapter.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      this.logger.warn('Razorpay webhook signature mismatch — rejecting');
      throw new UnauthorizedException({ code: 'webhook.invalid_signature' });
    }

    // Parse only after signature is verified.
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException({ code: 'webhook.invalid_json' });
    }

    const event = typeof payload['event'] === 'string' ? payload['event'] : 'unknown';

    if (event === 'payment.captured') {
      const paymentEntity = (payload['payload'] as Record<string, unknown> | undefined)?.['payment'] as Record<string, unknown> | undefined;
      const entity = paymentEntity?.['entity'] as Record<string, unknown> | undefined;
      const razorpayPaymentId = typeof entity?.['id'] === 'string' ? entity['id'] : '';
      const razorpayOrderId   = typeof entity?.['order_id'] === 'string' ? entity['order_id'] : '';
      // notes.shopId is UNTRUSTED — kept only as a debugging hint in the job payload.
      // The actual shopId used for DB writes is resolved inside confirmWebhookPayment
      // by looking up the payments row via razorpay_order_id.
      const notes    = (entity?.['notes'] as Record<string, string> | undefined) ?? {};
      const shopIdHint = notes['shopId'] ?? '';

      if (!razorpayPaymentId || !razorpayOrderId) {
        this.logger.warn({ event, razorpayPaymentId, razorpayOrderId }, 'Webhook missing payment IDs — skipping enqueue');
        return { status: 'ok' };
      }

      const job: RazorpayWebhookJob = {
        event,
        razorpayPaymentId,
        razorpayOrderId,
        shopIdHint,
        rawPayload: rawBody,
      };

      // Fast ACK — enqueue and return 200 immediately.
      await this.webhookQueue.add('payment.captured', job, {
        attempts:  3,
        backoff:   { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      });
    } else {
      this.logger.log({ event }, 'Unhandled Razorpay webhook event — ignored');
    }

    return { status: 'ok' };
  }
}
