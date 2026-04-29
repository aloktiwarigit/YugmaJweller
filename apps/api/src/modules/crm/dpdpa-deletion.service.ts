import { Injectable, Inject, UnprocessableEntityException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Pool } from 'pg';
import type { Queue } from '@goldsmith/queue';
import { auditLog, AuditAction } from '@goldsmith/audit';
import type { AuthenticatedTenantContext, TenantContext } from '@goldsmith/tenant-context';
import { DpdpaDeletionRepository } from './dpdpa-deletion.repository';
import type { DueForHardDelete } from './dpdpa-deletion.repository';
import { CrmSearchService } from './crm-search.service';
import { withTenantTx } from '@goldsmith/db';

export interface RequestDeletionResponse {
  scheduledAt:  string;
  hardDeleteAt: string;
}

export interface HardDeleteJobData {
  shopId:       string;
  customerId:   string;
  hardDeleteAt: string; // ISO — used for diagnostic logging only; sweep is the real timer
}

export const DPDPA_HARD_DELETE_QUEUE = 'dpdpa-hard-delete';
export const HARD_DELETE_JOB_NAME    = 'hard-delete';

@Injectable()
export class DpdpaDeletionService {
  private readonly logger = new Logger(DpdpaDeletionService.name);

  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    @Inject(DpdpaDeletionRepository) private readonly repo: DpdpaDeletionRepository,
    @Inject(CrmSearchService) private readonly searchSvc: CrmSearchService,
    @InjectQueue(DPDPA_HARD_DELETE_QUEUE) private readonly queue: Queue<HardDeleteJobData>,
  ) {}

  /**
   * Step 1 of DPDPA erasure. PII is scrubbed immediately; the row shell stays
   * for 30 days so audit trails point to a stable id. Step 2 (hard-delete) is
   * driven by a delayed BullMQ job + a daily safety-net sweep.
   */
  async requestDeletion(
    ctx: AuthenticatedTenantContext,
    customerId: string,
    requestedBy: 'customer' | 'owner',
  ): Promise<RequestDeletionResponse> {
    const { scheduledAt, hardDeleteAt } = await this.repo.softDeleteAtomic(customerId, requestedBy);

    // Remove from Meilisearch immediately so search results don't expose deleted customers.
    void this.searchSvc.removeFromIndex(ctx.shopId, customerId).catch(() => undefined);

    void auditLog(this.pool, {
      action:      AuditAction.CRM_CUSTOMER_DELETION_REQUESTED,
      subjectType: 'customer',
      subjectId:   customerId,
      actorUserId: ctx.userId,
      after:       { requestedBy, scheduledAt: scheduledAt.toISOString(), hardDeleteAt: hardDeleteAt.toISOString() },
    }).catch(() => undefined);

    void auditLog(this.pool, {
      action:      AuditAction.CRM_CUSTOMER_SOFT_DELETED,
      subjectType: 'customer',
      subjectId:   customerId,
      actorUserId: ctx.userId,
      after:       { piiScrubbed: true, hardDeleteScheduledAt: hardDeleteAt.toISOString() },
    }).catch(() => undefined);

    const delay = Math.max(0, hardDeleteAt.getTime() - Date.now());
    await this.queue.add(
      HARD_DELETE_JOB_NAME,
      { shopId: ctx.shopId, customerId, hardDeleteAt: hardDeleteAt.toISOString() },
      {
        delay,
        jobId: `hard-delete:${ctx.shopId}:${customerId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 }, // 1m, 2m, 4m
        removeOnComplete: 100,
        removeOnFail:     500,
      },
    );

    return {
      scheduledAt:  scheduledAt.toISOString(),
      hardDeleteAt: hardDeleteAt.toISOString(),
    };
  }

  /**
   * Read a customer row regardless of deleted_at. Used by requestDeletion so
   * that a confirmation-name check on an already-requested customer still works
   * (the standard getCustomer path excludes deleted rows).
   */
  async getCustomerIncludingDeleted(ctx: TenantContext, id: string): Promise<{ name: string }> {
    return withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{ id: string; name: string }>(
        `SELECT id, name FROM customers WHERE id = $1 AND shop_id = current_setting('app.current_shop_id')::uuid`,
        [id],
      );
      if (!r.rows[0]) {
        const { NotFoundException } = await import('@nestjs/common');
        throw new NotFoundException({ code: 'crm.customer_not_found' });
      }
      void ctx;
      return r.rows[0];
    });
  }

  /**
   * Restore is intentionally impossible after a deletion request: PII has
   * already been scrubbed and there is no encrypted archive to recover from.
   * The 30-day window only delays the row-shell removal — not PII recovery.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async restoreDeletion(_ctx: AuthenticatedTenantContext, _customerId: string): Promise<never> {
    throw new UnprocessableEntityException({
      code: 'crm.deletion.pii_already_scrubbed',
      message:
        'PII was scrubbed when deletion was requested. ' +
        'Restoration is not possible — the customer must re-register if they wish to continue.',
    });
  }

  /**
   * Worker entry point. Caller must have set tenantContext via runWith(ctx)
   * for the matching shopId before invoking this. ctx is accepted for log
   * correlation; actual scoping is enforced by withTenantTx + RLS.
   */
  async executeHardDelete(ctx: TenantContext, customerId: string): Promise<void> {
    const ok = await this.repo.hardDeleteAtomic(customerId);
    if (!ok) {
      this.logger.log(
        `dpdpa.executeHardDelete: skipped customerId=${customerId} shopId=${ctx.shopId} ` +
        `(already deleted, or not yet eligible)`,
      );
      return;
    }
    void auditLog(this.pool, {
      action:      AuditAction.CRM_CUSTOMER_HARD_DELETED,
      subjectType: 'customer',
      subjectId:   customerId,
      after:       { hardDeletedAt: new Date().toISOString() },
    }).catch(() => undefined);
  }

  async findDueForHardDelete(): Promise<DueForHardDelete[]> {
    return this.repo.findDueForHardDelete();
  }
}
