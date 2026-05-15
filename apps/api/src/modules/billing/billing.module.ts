import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { Redis } from '@goldsmith/cache';
import { LocalKMS, DevKmsAdapter } from '@goldsmith/crypto-envelope';
import { SettingsCache } from '@goldsmith/tenant-config';
import { StorageModule } from '@goldsmith/integrations-storage';
import { RazorpayAdapter, StubPaymentsAdapter } from '@goldsmith/integrations-payments';
import { AuthModule }      from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule }   from '../pricing/pricing.module';
import { LoyaltyModule }   from '../loyalty/loyalty.module';
import { RateLockBookingsModule } from '../rate-lock-bookings/rate-lock-bookings.module';
import { SettingsRepository } from '../settings/settings.repository';
import { BillingController } from './billing.controller';
import { BillingService }    from './billing.service';
import { EstimateService }   from './estimate.service';
import { BillingRepository } from './billing.repository';
import { PaymentService }    from './payment.service';
import { VoidService }       from './void.service';
import { ShareService }      from './share.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { GstrExportService } from './gstr-export.service';
import { ComplianceReportsController } from './compliance-reports.controller';
import { ComplianceReportsService } from './compliance-reports.service';
import { UrdService }        from './urd.service';
import { CompliancePmlaProcessor } from '../../workers/compliance-pmla.processor';
import { GstrExportProcessor }     from '../../workers/gstr-export.processor';

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: false }),
    AuthModule,
    InventoryModule,
    PricingModule,
    LoyaltyModule,
    RateLockBookingsModule,
    StorageModule,
    BullModule.registerQueue({ name: 'compliance-pmla' }),
    BullModule.registerQueue({ name: 'gstr-export' }),
    BullModule.registerQueue({ name: 'razorpay-webhooks' }),
  ],
  controllers: [BillingController, ComplianceReportsController],
  providers: [
    BillingService,
    EstimateService,
    BillingRepository,
    PaymentService,
    VoidService,
    ShareService,
    InvoicePdfService,
    GstrExportService,
    ComplianceReportsService,
    UrdService,
    CompliancePmlaProcessor,
    GstrExportProcessor,
    SettingsRepository,
    {
      provide: 'PAYMENTS_ADAPTER',
      useFactory: () => {
        const adapter = process.env['PAYMENTS_ADAPTER'] ?? '';
        if (adapter === 'razorpay') return new RazorpayAdapter();
        // Explicit stub is permitted for demo/staging deployments.
        if (adapter === 'stub') return new StubPaymentsAdapter();
        // Fail-closed in production: guard against unset/unknown adapter.
        // Stub accepts any webhook signature — never run without explicit opt-in.
        if (process.env['NODE_ENV'] === 'production') {
          throw new Error(
            'PAYMENTS_ADAPTER must be "razorpay" or "stub" in production. ' +
            'Unset or unknown adapter values are rejected to prevent misconfigured containers.',
          );
        }
        return new StubPaymentsAdapter();
      },
    },
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
  exports: [BillingService, PaymentService, 'PAYMENTS_ADAPTER'],
})
export class BillingModule {}
