import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BillingModule } from '../billing/billing.module';
import { RazorpayWebhookController } from './razorpay.controller';
import { RazorpayWebhookProcessor } from '../../workers/razorpay-webhook.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'razorpay-webhooks' }),
    BillingModule,
  ],
  controllers: [RazorpayWebhookController],
  providers: [RazorpayWebhookProcessor],
})
export class WebhooksModule {}
