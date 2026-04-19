import { Module, type ExecutionContext, type CallHandler, Injectable, type NestInterceptor } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { TenantInterceptor } from '@goldsmith/tenant-context';
import { HealthController } from './health.controller';
import { SKIP_TENANT } from './common/decorators/skip-tenant.decorator';
import { HttpTenantResolver } from './tenant-resolver';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { FirebaseJwtGuard } from './common/guards/firebase-jwt.guard';
import { AuthModule } from './modules/auth/auth.module';
import { TenantBootModule } from './modules/tenant-boot/tenant-boot.module';
import { StaffModule } from './modules/staff/staff.module';
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
  imports: [AuthModule, TenantBootModule, StaffModule],
  controllers: [HealthController],
  providers: [
    HttpTenantResolver,
    DrizzleTenantLookup,
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
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector, inner: TenantInterceptor) =>
        new ConditionalTenantInterceptor(reflector, inner),
      inject: [Reflector, TenantInterceptor],
    },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
