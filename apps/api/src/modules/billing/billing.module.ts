import { Module } from '@nestjs/common';
import { Redis } from '@goldsmith/cache';
import { LocalKMS, DevKmsAdapter } from '@goldsmith/crypto-envelope';
import { SettingsCache } from '@goldsmith/tenant-config';
import { AuthModule }      from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule }   from '../pricing/pricing.module';
import { SettingsRepository } from '../settings/settings.repository';
import { BillingController } from './billing.controller';
import { BillingService }    from './billing.service';
import { BillingRepository } from './billing.repository';
import { PaymentService }    from './payment.service';

@Module({
  imports: [AuthModule, InventoryModule, PricingModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingRepository,
    PaymentService,
    SettingsRepository,
    {
      provide: 'BILLING_REDIS',
      useFactory: () =>
        new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 3,
        }),
    },
    {
      provide: 'KMS_ADAPTER',
      useFactory: () => {
        const secret = process.env['KMS_MASTER_SECRET'];
        // DevKmsAdapter survives restarts via HKDF-derived keys.
        // LocalKMS is an in-memory fallback for local dev only — restart loses keys.
        return secret ? new DevKmsAdapter(secret) : new LocalKMS();
      },
    },
    {
      provide: SettingsCache,
      useFactory: (redis: Redis) => new SettingsCache(redis, 60),
      inject: ['BILLING_REDIS'],
    },
  ],
})
export class BillingModule {}
