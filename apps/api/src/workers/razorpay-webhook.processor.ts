import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from '@goldsmith/queue';
import { AuditAction, auditLog } from '@goldsmith/audit';
import type { Pool } from 'pg';
import { PaymentService } from '../modules/billing/payment.service';
import type { RazorpayWebhookJob } from '../modules/webhooks/razorpay.controller';

@Processor('razorpay-webhooks')
export class RazorpayWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(RazorpayWebhookProcessor.name);

  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly paymentService: PaymentService,
  ) {
    super();
  }

  async process(job: Job<RazorpayWebhookJob>): Promise<void> {
    const { event, razorpayPaymentId, razorpayOrderId, shopIdHint } = job.data;

    if (event === 'payment.captured') {
      this.logger.log({ razorpayPaymentId, razorpayOrderId, shopIdHint }, 'Processing payment.captured webhook');
      // shopIdHint is NOT used for DB writes — confirmWebhookPayment derives the real
      // shopId from the payments table via razorpay_order_id.
      await this.paymentService.confirmWebhookPayment(razorpayPaymentId, razorpayOrderId, shopIdHint);
      this.logger.log({ razorpayPaymentId }, 'Webhook payment confirmed');
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<RazorpayWebhookJob> | undefined, error: Error): Promise<void> {
    this.logger.error(
      `razorpay-webhooks job failed: jobId=${job?.id ?? 'unknown'} attempts=${job?.attemptsMade ?? 0} error=${error.message}`,
      error.stack,
    );

    // After exhausting all retries, audit PAYMENT_FAILED.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
      const { razorpayPaymentId, razorpayOrderId, shopIdHint } = job.data;
      try {
        await auditLog(this.pool, {
          action:      AuditAction.PAYMENT_FAILED,
          subjectType: 'payment',
          subjectId:   razorpayOrderId,
          actorUserId: undefined,
          after: {
            razorpayPaymentId,
            razorpayOrderId,
            shopIdHint,
            error:        error.message,
            attemptsMade: String(job.attemptsMade),
          },
        });
      } catch (auditErr) {
        this.logger.error('Failed to write PAYMENT_FAILED audit', auditErr);
      }
    }
  }
}
