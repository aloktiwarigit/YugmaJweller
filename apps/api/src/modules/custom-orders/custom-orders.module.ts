import { Module } from '@nestjs/common';
import { StorageModule } from '@goldsmith/integrations-storage';
import { RazorpayAdapter, StubPaymentsAdapter } from '@goldsmith/integrations-payments';
import { BillingModule } from '../billing/billing.module';
import { CustomOrdersController } from './custom-orders.controller';
import { CustomOrdersService } from './custom-orders.service';
import { CustomOrdersRepository } from './custom-orders.repository';

@Module({
  imports: [StorageModule, BillingModule],
  controllers: [CustomOrdersController],
  providers: [
    CustomOrdersService,
    CustomOrdersRepository,
    {
      provide: 'PAYMENTS_ADAPTER',
      useFactory: () => {
        const adapter = process.env['PAYMENTS_ADAPTER'] ?? 'stub';
        if (adapter === 'razorpay') return new RazorpayAdapter();
        if (process.env['NODE_ENV'] === 'production') {
          throw new Error(
            'PAYMENTS_ADAPTER must be set to "razorpay" in production.',
          );
        }
        return new StubPaymentsAdapter();
      },
    },
  ],
  exports: [CustomOrdersService],
})
export class CustomOrdersModule {}
