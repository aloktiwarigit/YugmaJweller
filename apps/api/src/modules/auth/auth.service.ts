import { ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Pool } from 'pg';
import { auditLog, platformAuditLog, AuditAction } from '@goldsmith/audit';
import { tenantContext, type Tenant, type AuthenticatedTenantContext, type ShopUserRole } from '@goldsmith/tenant-context';
import { withTenantTx } from '@goldsmith/db';
import type { InviteStaffDto } from '@goldsmith/shared';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import { AuthRepository } from './auth.repository';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { SMS_ADAPTER, type ISmsAdapter } from './sms/sms-adapter.interface';
import { AuditLogRepository, type AuditLogFilters, type PaginatedAuditLog } from './audit-log.repository';

export interface SessionResult {
  user: { id: string; display_name: string; role: ShopUserRole };
  tenant: { id: string; slug: string; display_name: string; config: Record<string, unknown> };
  requires_token_refresh: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    @Inject(FirebaseAdminProvider) private readonly firebase: FirebaseAdminProvider,
    @Inject(AuthRepository) private readonly repo: AuthRepository,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
    @Inject(SMS_ADAPTER) private readonly smsAdapter: ISmsAdapter,
    @Inject(AuditLogRepository) private readonly auditLogRepo: AuditLogRepository,
  ) {}

  async session(args: { uid: string; phoneE164: string; ip?: string; userAgent?: string; requestId?: string }): Promise<SessionResult> {
    // 1. Rate-limit check
    const rl = await this.rateLimit.check(args.phoneE164);
    if (!rl.ok) {
      await platformAuditLog(this.pool, {
        action: AuditAction.AUTH_VERIFY_LOCKED,
        phoneE164: args.phoneE164, ipAddress: args.ip, userAgent: args.userAgent, requestId: args.requestId,
      });
      throw new ForbiddenException({ code: 'auth.locked', retryAfterSeconds: rl.retryAfterSeconds });
    }

    // 2. Lookup by phone
    const row = await this.repo.lookupByPhone(args.phoneE164);
    if (!row) {
      await this.rateLimit.recordFailure(args.phoneE164);
      await platformAuditLog(this.pool, {
        action: AuditAction.AUTH_VERIFY_FAILURE,
        phoneE164: args.phoneE164, ipAddress: args.ip, userAgent: args.userAgent, requestId: args.requestId,
      });
      throw new ForbiddenException({ code: 'auth.not_provisioned' });
    }
    if (row.status !== 'ACTIVE' && row.status !== 'INVITED') {
      await platformAuditLog(this.pool, {
        action: AuditAction.AUTH_VERIFY_REJECTED,
        phoneE164: args.phoneE164, metadata: { status: row.status },
        ipAddress: args.ip, userAgent: args.userAgent, requestId: args.requestId,
      });
      throw new ForbiddenException({ code: 'auth.rejected' });
    }

    // 3. UID collision guard
    if (row.firebaseUid && row.firebaseUid !== args.uid) {
      await platformAuditLog(this.pool, {
        action: AuditAction.AUTH_UID_MISMATCH,
        phoneE164: args.phoneE164, metadata: { existing: row.firebaseUid, incoming: args.uid },
        ipAddress: args.ip, userAgent: args.userAgent, requestId: args.requestId,
      });
      throw new ForbiddenException({ code: 'auth.uid_mismatch' });
    }

    // 4. Load tenant + link firebase_uid if first-time (atomic UPDATE guards against TOCTOU race)
    const tenant = await this.loadTenantById(row.shopId);
    const firstTime = !row.firebaseUid;
    if (firstTime) {
      const { linked } = await this.repo.linkFirebaseUid({ shopId: row.shopId, userId: row.userId, firebaseUid: args.uid, tenant });
      if (!linked) {
        // A concurrent /session with a different UID won the race and wrote its UID first.
        await platformAuditLog(this.pool, {
          action: AuditAction.AUTH_UID_MISMATCH,
          phoneE164: args.phoneE164, metadata: { incoming: args.uid, reason: 'race' },
          ipAddress: args.ip, userAgent: args.userAgent, requestId: args.requestId,
        });
        throw new ForbiddenException({ code: 'auth.uid_mismatch' });
      }
      await this.auditProvisioned({ tenant, userId: row.userId, role: row.role, requestId: args.requestId });
    }

    // 5. Record success — user is verified at this point; move before setCustomUserClaims so
    //    a Firebase quota/network failure doesn't leave a stale rate-limit row.
    await this.rateLimit.recordSuccess(args.phoneE164);

    // 6. Set Firebase custom claims so subsequent ID tokens carry shop_id + role + user_id (DB UUID)
    await this.firebase.admin().auth().setCustomUserClaims(args.uid, {
      shop_id: row.shopId,
      role: row.role,
      user_id: row.userId,  // DB UUID — enables TenantInterceptor to propagate userId without extra query
    });

    // 7. Audit verify-success
    await this.auditVerifySuccess({ tenant, userId: row.userId, role: row.role, ip: args.ip, userAgent: args.userAgent, requestId: args.requestId });

    // 8. Load display_name under tenant ctx
    const user = await this.loadUserDisplayName({ tenant, userId: row.userId, role: row.role });

    return {
      user: { id: row.userId, display_name: user.display_name, role: row.role },
      tenant: { id: tenant.id, slug: tenant.slug, display_name: tenant.display_name, config: (tenant.config ?? {}) as Record<string, unknown> },
      requires_token_refresh: true,
    };
  }

  async invite(shopId: string, dto: InviteStaffDto, invitedByUserId: string): Promise<{ userId: string }> {
    const tenant = await this.loadTenantById(shopId);
    const result = await this.repo.inviteStaff({
      shopId,
      phone: dto.phone,
      role: dto.role,
      displayName: dto.display_name,
      invitedByUserId,
      tenant,
    });
    if (result.conflict) {
      throw new ConflictException({ errorCode: 'auth.invite_conflict', message: 'User already exists in this shop' });
    }
    const ctx: AuthenticatedTenantContext = {
      shopId, tenant,
      authenticated: true, userId: invitedByUserId, role: 'shop_admin' as ShopUserRole,
    };
    await tenantContext.runWith(ctx, () =>
      auditLog(this.pool, {
        action: AuditAction.STAFF_INVITED,
        subjectType: 'shop_user',
        subjectId: result.userId,
        actorUserId: invitedByUserId,
        metadata: { role: dto.role, display_name: dto.display_name },
      }),
    );
    await this.smsAdapter.sendInvite(dto.phone, shopId, result.userId!);
    return { userId: result.userId! };
  }

  async getAuditLog(
    filters: AuditLogFilters,
  ): Promise<PaginatedAuditLog & { page: number; pageSize: number }> {
    const result = await this.auditLogRepo.findPaginated(filters);
    return { ...result, page: filters.page, pageSize: Math.min(filters.pageSize, 50) };
  }

  async logoutAll(userId: string, firebaseUid: string): Promise<void> {
    await this.firebase.admin().auth().revokeRefreshTokens(firebaseUid);
    await auditLog(this.pool, {
      action: AuditAction.AUTH_LOGOUT_ALL,
      subjectType: 'shop_user',
      subjectId: userId,
      actorUserId: userId,
      metadata: { deviceCount: 'all' },
    });
  }

  private async loadTenantById(id: string): Promise<Tenant> {
    const c = await this.pool.connect();
    try {
      const r = await c.query(`SELECT id, slug, display_name, status, config FROM shops WHERE id = $1`, [id]);
      if (r.rows.length === 0) throw new UnauthorizedException({ code: 'tenant.not_found' });
      const tenant = r.rows[0] as Tenant;
      if (tenant.status !== 'ACTIVE') throw new ForbiddenException({ code: 'tenant.inactive' });
      return tenant;
    } finally { c.release(); }
  }

  private async auditProvisioned(args: { tenant: Tenant; userId: string; role: ShopUserRole; requestId?: string }): Promise<void> {
    const ctx: AuthenticatedTenantContext = {
      shopId: args.tenant.id, tenant: args.tenant,
      authenticated: true, userId: args.userId, role: args.role,
    };
    await tenantContext.runWith(ctx, () =>
      auditLog(this.pool, {
        action: AuditAction.AUTH_USER_PROVISIONED,
        subjectType: 'shop_user', subjectId: args.userId, actorUserId: args.userId,
        metadata: { requestId: args.requestId },
      }),
    );
  }

  private async auditVerifySuccess(args: { tenant: Tenant; userId: string; role: ShopUserRole; ip?: string; userAgent?: string; requestId?: string }): Promise<void> {
    const ctx: AuthenticatedTenantContext = {
      shopId: args.tenant.id, tenant: args.tenant,
      authenticated: true, userId: args.userId, role: args.role,
    };
    await tenantContext.runWith(ctx, () =>
      auditLog(this.pool, {
        action: AuditAction.AUTH_VERIFY_SUCCESS,
        subjectType: 'shop_user', subjectId: args.userId, actorUserId: args.userId,
        ip: args.ip, userAgent: args.userAgent,
        metadata: { requestId: args.requestId },
      }),
    );
  }

  private async loadUserDisplayName(args: { tenant: Tenant; userId: string; role: ShopUserRole }): Promise<{ display_name: string }> {
    const ctx: AuthenticatedTenantContext = {
      shopId: args.tenant.id, tenant: args.tenant,
      authenticated: true, userId: args.userId, role: args.role,
    };
    return tenantContext.runWith(ctx, () =>
      withTenantTx(this.pool, async (tx) => {
        const r = await tx.query(`SELECT display_name FROM shop_users WHERE id = $1`, [args.userId]);
        if (r.rows.length === 0) throw new UnauthorizedException({ code: 'auth.user_not_found' });
        return r.rows[0] as { display_name: string };
      }),
    );
  }
}
