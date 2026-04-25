import { Module } from '@nestjs/common';
import { Redis } from '@goldsmith/cache';
import { AuthModule }      from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule }   from '../pricing/pricing.module';
import { BillingController } from './billing.controller';
import { BillingService }    from './billing.service';
import { BillingRepository } from './billing.repository';

@Module({
  imports: [AuthModule, InventoryModule, PricingModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingRepository,
    {
      provide: 'BILLING_REDIS',
      useFactory: () =>
        new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 3,
        }),
    },
  ],
})
export class BillingModule {}
