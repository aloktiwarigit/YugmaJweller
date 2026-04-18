import { Module, type ExecutionContext, type CallHandler, Injectable, type NestInterceptor } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { HealthController } from './health.controller';
import { SKIP_TENANT } from './common/decorators/skip-tenant.decorator';
import { HttpTenantResolver } from './tenant-resolver';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TenantInterceptor, type TenantLookup, type Tenant } from '@goldsmith/tenant-context';

@Injectable()
class NoopTenantLookup implements TenantLookup {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async byId(_id: string): Promise<Tenant | undefined> { return undefined; }
}

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
  controllers: [HealthController],
  providers: [
    HttpTenantResolver,
    NoopTenantLookup,
    {
      provide: TenantInterceptor,
      useFactory: (resolver: HttpTenantResolver, tenants: NoopTenantLookup) =>
        new TenantInterceptor(resolver, tenants),
      inject: [HttpTenantResolver, NoopTenantLookup],
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector, inner: TenantInterceptor) =>
        new ConditionalTenantInterceptor(reflector, inner),
      inject: [Reflector, TenantInterceptor],
    },
    { provide: APP_FILTER,      useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
