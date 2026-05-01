import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantLookupModule } from '../tenant-lookup/tenant-lookup.module';
import { PlatformAdminController } from './platform-admin.controller';
import { TenantManagementService } from './services/tenant-management.service';
import { SubscriptionService } from './services/subscription.service';
import { MetricsService } from './services/metrics.service';
import { ImpersonationService } from './services/impersonation.service';
import { DataExportService } from './services/data-export.service';
import { ImpersonationSessionAdapter } from './impersonation-session.adapter';

@Module({
  // TenantLookupModule provides the singleton DrizzleTenantLookup that TenantInterceptor
  // also consumes. Importing the shared module (instead of registering a second
  // DrizzleTenantLookup provider here) ensures TenantManagementService.{suspend,unsuspend,update}
  // invalidates the same cache the interceptor reads from.
  imports: [AuthModule, TenantLookupModule],
  controllers: [PlatformAdminController],
  providers: [
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
