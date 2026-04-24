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
    /** DB UUID from the goldsmith_uid custom claim; undefined on very first /session call */
    goldsmith_uid?: string;
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

    // req.user.goldsmith_uid is the DB UUID from the Firebase custom claim.
    // On the very first /session call the token has no custom claims yet — goldsmith_uid is undefined,
    // so we fall through to UnauthenticatedTenantContext. /session responds requires_token_refresh: true;
    // the client force-refreshes and subsequent calls carry goldsmith_uid.
    // NOTE: "user_id" is a reserved Firebase claim — it gets overridden with the Firebase UID.
    if (req.user?.uid && req.user.role && req.user.shop_id === shopId && req.user.goldsmith_uid) {
      return {
        shopId: tenant.id, tenant,
        authenticated: true, userId: req.user.goldsmith_uid, role: req.user.role,
      };
    }
    return { shopId: tenant.id, tenant, authenticated: false };
  }
}
