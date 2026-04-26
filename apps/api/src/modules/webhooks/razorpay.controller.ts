import {
  Controller,
  Headers,
  Inject,
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
  shopId: string;
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
    // rawBody is populated only if NestJS was created with { rawBody: true }
    // and the route has the express raw-body middleware applied.
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body);

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
      const notes             = (entity?.['notes'] as Record<string, string> | undefined) ?? {};
      const shopId            = notes['shopId'] ?? '';

      if (!razorpayPaymentId || !razorpayOrderId || !shopId) {
        this.logger.warn({ event, razorpayPaymentId, razorpayOrderId, shopId }, 'Webhook missing required fields — skipping enqueue');
        return { status: 'ok' };
      }

      const job: RazorpayWebhookJob = {
        event,
        razorpayPaymentId,
        razorpayOrderId,
        shopId,
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
