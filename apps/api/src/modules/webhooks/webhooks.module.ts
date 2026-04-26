import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RazorpayAdapter, StubPaymentsAdapter } from '@goldsmith/integrations-payments';
import { BillingModule } from '../billing/billing.module';
import { RazorpayWebhookController } from './razorpay.controller';
import { RazorpayWebhookProcessor } from '../../workers/razorpay-webhook.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'razorpay-webhooks' }),
    BillingModule,
  ],
  controllers: [RazorpayWebhookController],
  providers: [
    RazorpayWebhookProcessor,
    {
      provide: 'PAYMENTS_ADAPTER',
      useFactory: () => {
        const adapter = process.env['PAYMENTS_ADAPTER'] ?? 'stub';
        return adapter === 'razorpay' ? new RazorpayAdapter() : new StubPaymentsAdapter();
      },
    },
  ],
})
export class WebhooksModule {}
