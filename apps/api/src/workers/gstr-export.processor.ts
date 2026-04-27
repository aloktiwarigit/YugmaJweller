import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Pool } from 'pg';
import type { Job } from '@goldsmith/queue';
import { tenantContext } from '@goldsmith/tenant-context';
import type { TenantContext, Tenant } from '@goldsmith/tenant-context';
import { GstrExportService } from '../modules/billing/gstr-export.service';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import type { StoragePort } from '@goldsmith/integrations-storage';

export interface GstrExportJob {
  shopId: string;
  month: string;
  type: 'gstr1' | 'gstr3b';
}

@Processor('gstr-export')
export class GstrExportProcessor extends WorkerHost {
  private readonly logger = new Logger(GstrExportProcessor.name);

  constructor(
    @Inject(GstrExportService) private readonly gstrSvc: GstrExportService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {
    super();
  }

  async process(job: Job<GstrExportJob>): Promise<{ storageKey: string }> {
    const { shopId, month, type } = job.data;
    this.logger.log(`GSTR export: shopId=${shopId} month=${month} type=${type}`);

    // Workers run outside the HTTP request lifecycle, so the tenant-context
    // interceptor never fires. GstrExportService.fetchMonthInvoices calls
    // tenantContext.requireCurrent(), which would throw tenant.context_not_set
    // unless we wrap the service call with runWith() over a context built
    // from job.data.shopId.
    const ctx = await this.buildTenantCtx(shopId);

    const csv = await tenantContext.runWith(ctx, () =>
      type === 'gstr1'
        ? this.gstrSvc.generateGstr1Csv(month)
        : this.gstrSvc.generateGstr3bSummary(month),
    );

    const filename = `${type}-${month}.csv`;
    const key = `tenants/${shopId}/gstr/${filename}`;
    await this.storage.uploadBuffer(key, Buffer.from(csv, 'utf8'), 'text/csv; charset=utf-8');
    const url = await this.storage.getPresignedReadUrl(key);
    this.logger.log(`GSTR export uploaded: key=${key} url=${url}`);
    return { storageKey: key };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `gstr-export job failed: jobId=${job?.id ?? 'unknown'} name=${job?.name ?? 'unknown'} error=${error.message}`,
      error.stack,
    );
  }

  // ADR-0005 forbids raw shopId params, but this method is the boundary
  // that converts a BullMQ job payload (the only carrier of tenant identity
  // for background jobs) into a real TenantContext. It cannot accept a
  // TenantContext because none exists yet at this entry point.
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param
  private async buildTenantCtx(shopId: string): Promise<TenantContext> {
    const r = await this.pool.query<{ id: string; slug: string; display_name: string; status: Tenant['status'] }>(
      `SELECT id, slug, display_name, status FROM shops WHERE id = $1`,
      [shopId],
    );
    const row = r.rows[0];
    if (!row) throw new Error(`gstr-export: shop ${shopId} not found`);
    return {
      authenticated: false,
      shopId,
      tenant: { id: row.id, slug: row.slug, display_name: row.display_name, status: row.status },
    };
  }
}
