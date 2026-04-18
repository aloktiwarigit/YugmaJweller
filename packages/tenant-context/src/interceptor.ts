import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { from, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { tenantContext } from './als';
import type { TenantContext, ShopUserRole } from './context';
import type { TenantLookup } from './tenant-cache';

export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  hostname?: string;
  path?: string;
}

export interface TenantResolver {
  fromHost(host: string): Promise<string | undefined>;
  fromHeader(req: RequestLike): string | undefined;
  fromJwt(req: RequestLike): string | undefined;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly resolver: TenantResolver,
    private readonly tenants: TenantLookup,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return from(this.resolve(ctx)).pipe(switchMap((tc) =>
      new Observable<unknown>((sub) => {
        tenantContext.runWith(tc, () => {
          const inner = next.handle().subscribe({
            next: (v) => sub.next(v),
            error: (e) => sub.error(e),
            complete: () => sub.complete(),
          });
          return () => inner.unsubscribe();
        });
      }),
    ));
  }

  private async resolve(ctx: ExecutionContext): Promise<TenantContext> {
    const req = ctx.switchToHttp().getRequest<RequestLike & { user?: { shop_id?: string; uid?: string; role?: ShopUserRole } }>();

    // JWT → Host → Header priority.
    let shopId: string | undefined = this.resolver.fromJwt(req);
    if (!shopId && req.hostname) shopId = await this.resolver.fromHost(req.hostname);
    shopId ??= this.resolver.fromHeader(req);

    if (!shopId) throw new UnauthorizedException('tenant.resolution_failed');
    const tenant = await this.tenants.byId(shopId);
    if (!tenant) throw new UnauthorizedException('tenant.not_found');
    if (tenant.status !== 'ACTIVE') throw new ForbiddenException('tenant.inactive');

    if (req.user?.uid && req.user.role && req.user.shop_id === shopId) {
      return {
        shopId: tenant.id, tenant,
        authenticated: true, userId: req.user.uid, role: req.user.role,
      };
    }
    return { shopId: tenant.id, tenant, authenticated: false };
  }
}
