import { Module, type OnModuleDestroy } from '@nestjs/common';
import { createPool } from '@goldsmith/db';
import type { Pool } from 'pg';
import { AuthModule } from '../auth/auth.module';
import { TenantLookupModule } from '../tenant-lookup/tenant-lookup.module';
import { PlatformAdminController } from './platform-admin.controller';
import { TenantManagementService } from './services/tenant-management.service';
import { SubscriptionService } from './services/subscription.service';
import { MetricsService } from './services/metrics.service';
import { ImpersonationService } from './services/impersonation.service';
import { DataExportService } from './services/data-export.service';
import { ImpersonationSessionAdapter } from './impersonation-session.adapter';
import { PG_POOL_ADMIN } from './platform-admin.tokens';

// Dedicated platform_admin connection pool. The default `app_user` role (used by `PG_POOL`)
// has no membership in `platform_admin`, so `SET ROLE platform_admin` from an app_user
// session is denied by Postgres. Connect directly as platform_admin instead.
//
// Why this works against RLS-protected tables: migration 0000 creates platform_admin as
// NOBYPASSRLS, but migration 0003 then `ALTER ROLE platform_admin BYPASSRLS` (in a DO block).
// Pre-deploy DBA action documented in runbook §14 (the migrator role normally lacks SUPERUSER
// to make the ALTER itself, so the DBA pre-grants BYPASSRLS once before migration 0003 runs).
// The grant is verified at startup by migration 0003's RAISE EXCEPTION.
//
// Falls back to DATABASE_URL for dev convenience when DATABASE_URL_ADMIN isn't set
// (acceptable: dev Postgres typically uses a single superuser role with no RLS separation).
//
// PG_POOL_ADMIN token lives in ./platform-admin.tokens.ts to break the import cycle:
// services need the token at @Inject decoration time, but they're loaded as providers
// of THIS module — putting the const here would land services in our partial-exports
// during module load and resolve PG_POOL_ADMIN to undefined at DI time.

@Module({
  // TenantLookupModule provides the singleton DrizzleTenantLookup that TenantInterceptor
  // also consumes. Importing the shared module (instead of registering a second
  // DrizzleTenantLookup provider here) ensures TenantManagementService.{suspend,unsuspend,update}
  // invalidates the same cache the interceptor reads from.
  imports: [AuthModule, TenantLookupModule],
  controllers: [PlatformAdminController],
  providers: [
    {
      provide: PG_POOL_ADMIN,
      useFactory: (): Pool => createPool({
        connectionString:
          process.env['DATABASE_URL_ADMIN'] ??
          process.env['DATABASE_URL'] ??
          'postgres://platform_admin:placeholder_platform_admin@localhost:5432/goldsmith_dev',
      }),
    },
    TenantManagementService,
    SubscriptionService,
    MetricsService,
    ImpersonationService,
    DataExportService,
    ImpersonationSessionAdapter,
  ],
  exports: [ImpersonationSessionAdapter],
})
export class PlatformAdminModule implements OnModuleDestroy {
  // The DI container holds the pool by token; resolve it on shutdown to release sockets.
  // We can't @Inject by string token in a property field with strict TS, so we resolve via
  // moduleRef in onModuleDestroy. For now, the provider's idleTimeoutMillis (30s) reaps
  // idle connections quickly enough that an explicit shutdown is not strictly needed.
  async onModuleDestroy(): Promise<void> { /* pool eviction handled by app shutdown */ }
}
