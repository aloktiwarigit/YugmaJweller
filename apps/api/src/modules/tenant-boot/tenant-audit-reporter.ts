import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { platformAuditLog, AuditAction } from '@goldsmith/audit';
import type { TenantAuditPort } from '@goldsmith/tenant-context';

@Injectable()
export class TenantAuditReporter implements TenantAuditPort {
  private readonly logger = new Logger(TenantAuditReporter.name);
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  // Fire-and-forget; the interceptor throws regardless.
  claimConflict(args: { jwtShopId: string; headerShopId: string; requestId?: string; ip?: string; userAgent?: string }): void {
    void platformAuditLog(this.pool, {
      action: AuditAction.TENANT_CLAIM_CONFLICT,
      metadata: { jwtShopId: args.jwtShopId, headerShopId: args.headerShopId },
      ipAddress: args.ip,
      userAgent: args.userAgent,
      requestId: args.requestId,
    }).catch((err) => this.logger.error({ err }, 'claim-conflict audit write failed'));
  }
}
