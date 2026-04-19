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
import type { TenantAuditPort } from './audit-port';

export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  hostname?: string;
  path?: string;
  /** Populated by FirebaseJwtStrategy after token verification */
  user?: {
    uid?: string;
    shop_id?: string;
    role?: ShopUserRole;
    /** DB UUID from the user_id custom claim; undefined on very first /session call */
    user_id?: string;
  };
}

export interface TenantResolver {
  fromHost(host: string): Promise<string | undefined>;
  fromHeader(req: RequestLike): string | undefined;
  fromJwt(req: RequestLike): string | undefined;
}

function stringHeader(req: RequestLike, name: string): string | undefined {
  const v = req.headers[name];
  return typeof v === 'string' ? v : undefined;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly resolver: TenantResolver,
    private readonly tenants: TenantLookup,
    private readonly audit?: TenantAuditPort,
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
    const req = ctx.switchToHttp().getRequest<RequestLike>();

    const jwtShopId    = this.resolver.fromJwt(req);
    const headerShopId = this.resolver.fromHeader(req);

    if (jwtShopId && headerShopId && jwtShopId !== headerShopId) {
      const requestId = stringHeader(req, 'x-request-id');
      const ip = stringHeader(req, 'x-forwarded-for');
      const userAgent = stringHeader(req, 'user-agent');
      this.audit?.claimConflict({
        jwtShopId, headerShopId,
        ...(requestId !== undefined && { requestId }),
        ...(ip !== undefined && { ip }),
        ...(userAgent !== undefined && { userAgent }),
      });
      throw new ForbiddenException({ code: 'tenant.claim_conflict' });
    }

    // JWT → Host → Header priority.
    let shopId: string | undefined = jwtShopId;
    if (!shopId && req.hostname) shopId = await this.resolver.fromHost(req.hostname);
    shopId ??= headerShopId;

    if (!shopId) throw new UnauthorizedException('tenant.resolution_failed');
    const tenant = await this.tenants.byId(shopId);
    if (!tenant) throw new UnauthorizedException('tenant.not_found');
    if (tenant.status !== 'ACTIVE') throw new ForbiddenException('tenant.inactive');

    // req.user.user_id is the DB UUID from the Firebase custom claim.
    // On the very first /session call the token has no custom claims yet — user_id is undefined,
    // so we fall through to UnauthenticatedTenantContext. /session responds requires_token_refresh: true;
    // the client force-refreshes and subsequent calls carry user_id.
    if (req.user?.uid && req.user.role && req.user.shop_id === shopId && req.user.user_id) {
      return {
        shopId: tenant.id, tenant,
        authenticated: true, userId: req.user.user_id, role: req.user.role,
      };
    }
    return { shopId: tenant.id, tenant, authenticated: false };
  }
}
