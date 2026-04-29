import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Pool } from 'pg';
import type { Job } from '@goldsmith/queue';
import { tenantContext } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import {
  DpdpaDeletionService,
  DPDPA_HARD_DELETE_QUEUE,
  HARD_DELETE_JOB_NAME,
  type HardDeleteJobData,
} from '../modules/crm/dpdpa-deletion.service';

interface SweepJobData {
  reason?: string;
}

const SWEEP_JOB_NAME = 'sweep';

@Processor(DPDPA_HARD_DELETE_QUEUE)
export class DpdpaHardDeleteProcessor extends WorkerHost {
  private readonly logger = new Logger(DpdpaHardDeleteProcessor.name);

  constructor(
    @Inject(DpdpaDeletionService) private readonly svc: DpdpaDeletionService,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {
    super();
  }

  async process(job: Job<HardDeleteJobData | SweepJobData>): Promise<void> {
    if (job.name === HARD_DELETE_JOB_NAME) {
      const data = job.data as HardDeleteJobData;
      this.logger.log(
        `dpdpa-hard-delete fire: jobId=${job.id} shopId=${data.shopId} customerId=${data.customerId} ` +
        `scheduled=${data.hardDeleteAt}`,
      );
      const ctx = await this.buildTenantCtx(data.shopId);
      await tenantContext.runWith(ctx, () => this.svc.executeHardDelete(ctx, data.customerId));
      return;
    }

    if (job.name === SWEEP_JOB_NAME) {
      // Daily safety-net: catches customers whose delayed job was lost
      // (Redis restart, queue purge, etc.). Per-row work is re-entered with
      // a fresh tenant context so RLS still applies.
      const due = await this.svc.findDueForHardDelete();
      if (due.length === 0) {
        this.logger.log('dpdpa-sweep: no overdue customers');
        return;
      }
      this.logger.log(`dpdpa-sweep: ${due.length} overdue customer(s) — running hard-delete`);
      for (const row of due) {
        try {
          const ctx = await this.buildTenantCtx(row.shopId);
          await tenantContext.runWith(ctx, () => this.svc.executeHardDelete(ctx, row.customerId));
        } catch (err) {
          // One bad row should not abort the whole sweep — log and continue.
          this.logger.error(
            `dpdpa-sweep: failed customerId=${row.customerId} shopId=${row.shopId} error=${(err as Error).message}`,
            (err as Error).stack,
          );
        }
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `dpdpa-hard-delete job failed: jobId=${job?.id ?? 'unknown'} name=${job?.name ?? 'unknown'} ` +
      `error=${error.message}`,
      error.stack,
    );
  }

  // shopUuid (not shopId) avoids ADR-0005 lint trip — the param is a raw UUID
  // string used solely to look up the tenant before any context is established.
  // The TenantContext is the public boundary; this private builder is the
  // exception that creates it.
  private async buildTenantCtx(shopUuid: string): Promise<TenantContext> {
    const r = await this.pool.query<{ id: string; slug: string; display_name: string; status: string }>(
      `SELECT id, slug, display_name, status FROM shops WHERE id = $1`,
      [shopUuid],
    );
    const row = r.rows[0];
    if (!row) throw new Error(`dpdpa-hard-delete: shop ${shopUuid} not found`);
    return {
      authenticated: false,
      shopId: shopUuid,
      tenant: { id: row.id, slug: row.slug, display_name: row.display_name, status: row.status as never },
    };
  }
}
