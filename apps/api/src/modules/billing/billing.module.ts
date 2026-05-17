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
        const isProd  = process.env['NODE_ENV'] === 'production';
        // Demo escape hatch: a pre-revenue deploy (e.g. goldsmith-dev for the
        // jeweller demo) runs with NODE_ENV=production but no Razorpay creds.
        // Setting ALLOW_STUB_PAYMENTS=1 explicitly opts into the stub adapter
        // and logs a loud warning. Real-money tenants MUST NOT set this.
        const allowStub = process.env['ALLOW_STUB_PAYMENTS'] === '1';
        if (isProd && adapter !== 'razorpay' && !allowStub) {
          throw new Error(
            'PAYMENTS_ADAPTER must be "razorpay" in production. ' +
            'The stub payments adapter is only allowed in non-production environments. ' +
            'For demo/staging deployments in production mode, set ALLOW_STUB_PAYMENTS=1 explicitly.',
          );
        }
        if (adapter === 'razorpay') return new RazorpayAdapter();
        if (isProd && allowStub) {
          // eslint-disable-next-line no-console
          console.warn('[billing] ALLOW_STUB_PAYMENTS=1 — using StubPaymentsAdapter in production. Demo/staging only.');
        }
        // Explicit stub is permitted for non-production demo/staging deployments.
        if (adapter === 'stub') return new StubPaymentsAdapter();
        // Unknown non-production values fall back to the local stub.
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
