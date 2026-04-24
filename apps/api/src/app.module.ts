import { Module, type ExecutionContext, type CallHandler, Injectable, type NestInterceptor } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { Observable } from 'rxjs';
import { TenantInterceptor } from '@goldsmith/tenant-context';
import { HealthController } from './health.controller';
import { SKIP_TENANT } from './common/decorators/skip-tenant.decorator';
import { HttpTenantResolver } from './tenant-resolver';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { FirebaseJwtGuard } from './common/guards/firebase-jwt.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PolicyGuard } from './modules/auth/guards/policy.guard';
import { PermissionsCache } from '@goldsmith/tenant-config';
import { PermissionsRepository } from './modules/auth/permissions.repository';
import { AuthModule } from './modules/auth/auth.module';
import { TenantBootModule } from './modules/tenant-boot/tenant-boot.module';
import { TenantLookupModule } from './modules/tenant-lookup/tenant-lookup.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { InventoryModule } from './modules/inventory/inventory.module';

import { CatalogModule } from './modules/catalog/catalog.module';
import { SyncModule } from './modules/sync/sync.module';
import { DrizzleTenantLookup } from './drizzle-tenant-lookup';
import { TenantAuditReporter } from './modules/tenant-boot/tenant-audit-reporter';

@Injectable()
class ConditionalTenantInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly inner: TenantInterceptor,
  ) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT, [ctx.getHandler(), ctx.getClass()]);
    if (skip) return next.handle();
    return this.inner.intercept(ctx, next);
  }
}

@Module({
  imports: [
    BullModule.forRoot({
      connection: (() => {
        const u = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
        return {
          host: u.hostname,
          port: Number(u.port || 6379),
          ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
          ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
          ...(u.pathname && u.pathname !== '/' ? { db: Number(u.pathname.slice(1)) } : {}),
          ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
          lazyConnect: true,
          enableReadyCheck: false,
        };
      })(),
    }),
    AuthModule,
    TenantBootModule,
    TenantLookupModule,
    SettingsModule,
    InventoryModule,
    PricingModule,

    CatalogModule,
    SyncModule,
  ],
  controllers: [HealthController],
  providers: [
    HttpTenantResolver,
    {
      provide: TenantInterceptor,
      useFactory: (resolver: HttpTenantResolver, tenants: DrizzleTenantLookup, audit: TenantAuditReporter) =>
        new TenantInterceptor(resolver, tenants, audit),
      inject: [HttpTenantResolver, DrizzleTenantLookup, TenantAuditReporter],
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new FirebaseJwtGuard(reflector),
      inject: [Reflector],
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new RolesGuard(reflector),
      inject: [Reflector],
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, cache: PermissionsCache, repo: PermissionsRepository) =>
        new PolicyGuard(reflector, cache, repo),
      inject: [Reflector, PermissionsCache, PermissionsRepository],
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector, inner: TenantInterceptor) =>
        new ConditionalTenantInterceptor(reflector, inner),
      inject: [Reflector, TenantInterceptor],
    },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
