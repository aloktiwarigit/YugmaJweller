import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { Redis } from '@goldsmith/cache';
import { LocalKMS, DevKmsAdapter } from '@goldsmith/crypto-envelope';
import { SettingsCache } from '@goldsmith/tenant-config';
import { StorageModule } from '@goldsmith/integrations-storage';
import { AuthModule }      from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule }   from '../pricing/pricing.module';
import { SettingsRepository } from '../settings/settings.repository';
import { BillingController } from './billing.controller';
import { BillingService }    from './billing.service';
import { BillingRepository } from './billing.repository';
import { PaymentService }    from './payment.service';
import { VoidService }       from './void.service';
import { ShareService }      from './share.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { GstrExportService } from './gstr-export.service';
import { ComplianceReportsController } from './compliance-reports.controller';
import { ComplianceReportsService } from './compliance-reports.service';
import { CompliancePmlaProcessor } from '../../workers/compliance-pmla.processor';
import { GstrExportProcessor }     from '../../workers/gstr-export.processor';

@Module({
  imports: [
    AuthModule,
    InventoryModule,
    PricingModule,
    StorageModule,
    BullModule.registerQueue({ name: 'compliance-pmla' }),
    BullModule.registerQueue({ name: 'gstr-export' }),
  ],
  controllers: [BillingController, ComplianceReportsController],
  providers: [
    BillingService,
    BillingRepository,
    PaymentService,
    VoidService,
    ShareService,
    InvoicePdfService,
    GstrExportService,
    ComplianceReportsService,
    CompliancePmlaProcessor,
    GstrExportProcessor,
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
