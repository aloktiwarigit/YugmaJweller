import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';
import { PlatformAdminController } from './platform-admin.controller';
import { TenantManagementService } from './services/tenant-management.service';
import { SubscriptionService } from './services/subscription.service';
import { MetricsService } from './services/metrics.service';
import { ImpersonationService } from './services/impersonation.service';
import { DataExportService } from './services/data-export.service';
import { ImpersonationSessionAdapter } from './impersonation-session.adapter';

@Module({
  imports: [AuthModule],
  controllers: [PlatformAdminController],
  providers: [
    DrizzleTenantLookup,
    TenantManagementService,
    SubscriptionService,
    MetricsService,
    ImpersonationService,
    DataExportService,
    ImpersonationSessionAdapter,
  ],
  exports: [ImpersonationSessionAdapter],
})
export class PlatformAdminModule {}
