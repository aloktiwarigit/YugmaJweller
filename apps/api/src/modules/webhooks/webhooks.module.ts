import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { RazorpayWebhookController } from './razorpay.controller';
import { RazorpayWebhookProcessor } from '../../workers/razorpay-webhook.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'razorpay-webhooks' }),
    AuthModule,
    BillingModule,
  ],
  controllers: [RazorpayWebhookController],
  providers: [RazorpayWebhookProcessor],
})
export class WebhooksModule {}
