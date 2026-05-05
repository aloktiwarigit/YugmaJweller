import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Pool } from 'pg';
import type { Job } from '@goldsmith/queue';
import { tenantContext } from '@goldsmith/tenant-context';
import type { TenantContext, Tenant } from '@goldsmith/tenant-context';
import { withTenantTx } from '@goldsmith/db';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import type { StoragePort } from '@goldsmith/integrations-storage';
import { ReportsService } from '../modules/reports/reports.service';
import { PdfRenderer } from '../modules/reports/pdf/renderer';
import type { ReportType, ReportData } from '../modules/reports/pdf/renderer';
import { BrandingLoader } from '../modules/reports/pdf/branding';

export interface ReportsPdfJob {
  shopId:     string;
  exportId:   string;
  reportType: ReportType;
  params:     Record<string, unknown>;
}

@Processor('reports-pdf')
export class ReportsPdfProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsPdfProcessor.name);

  constructor(
    @Inject(ReportsService)  private readonly reports: ReportsService,
    @Inject(PdfRenderer)     private readonly renderer: PdfRenderer,
    @Inject(STORAGE_PORT)    private readonly storage: StoragePort,
    @Inject(BrandingLoader)  private readonly branding: BrandingLoader,
    @Inject('PG_POOL')       private readonly pool: Pool,
  ) {
    super();
  }

  async process(job: Job<ReportsPdfJob>): Promise<{ storageKey: string }> {
    const { shopId, exportId, reportType, params } = job.data;
    this.logger.log(
      `reports-pdf: shopId=${shopId} exportId=${exportId} type=${reportType}`,
    );

    const ctx = await this.buildTenantCtx(shopId);

    return tenantContext.runWith(ctx, async () => {
      // 1. Mark RUNNING (idempotent on retries — only QUEUED → RUNNING).
      //    If 0 rows affected, the row is already in a terminal state (READY
      //    or FAILED) from a prior attempt — exit fast to avoid re-rendering
      //    and clobbering the original terminal state.
      const runningResult = await withTenantTx(this.pool, async (tx) => {
        return tx.query(
          `UPDATE reports_pdf_exports
           SET status = 'RUNNING'
           WHERE id = $1 AND status = 'QUEUED'`,
          [exportId],
        );
      });
      if (runningResult.rowCount === 0) {
        this.logger.log(
          `reports-pdf: skipping exportId=${exportId} — already in non-QUEUED state (likely a retry of a completed/failed job)`,
        );
        return { storageKey: 'skipped' };
      }

      try {
        // 2. Fetch report data
        const data = await this.fetchReportData(reportType, params);

        // 3. Render PDF (branding loaded inside tenant context)
        const branding = await this.branding.load();
        const buf = await this.renderer.render(reportType, data, branding);

        // 4. Upload to storage under tenant-scoped key
        const filename = `${reportType}-${exportId}.pdf`;
        const key = `tenants/${shopId}/reports/${reportType}/${filename}`;
        await this.storage.uploadBuffer(key, buf, 'application/pdf');

        // 5. Mark READY (guard with status='RUNNING' to prevent overwriting a
        //    terminal FAILED row if execution path reached here under unusual
        //    retry/state transitions).
        const readyResult = await withTenantTx(this.pool, async (tx) => {
          return tx.query(
            `UPDATE reports_pdf_exports
             SET status = 'READY', storage_key = $2, completed_at = now()
             WHERE id = $1 AND status = 'RUNNING'`,
            [exportId, key],
          );
        });
        if (readyResult.rowCount === 0) {
          this.logger.warn(
            `reports-pdf: READY update affected 0 rows for exportId=${exportId} (state already terminal); skipping overwrite`,
          );
        }

        this.logger.log(
          `reports-pdf ok: shopId=${shopId} exportId=${exportId} key=${key}`,
        );
        return { storageKey: key };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        // Best-effort FAILED update — re-throw the original error so BullMQ
        // schedules a retry / surfaces it on the failed event handler below.
        await withTenantTx(this.pool, async (tx) => {
          await tx.query(
            `UPDATE reports_pdf_exports
             SET status = 'FAILED', error_message = $2, completed_at = now()
             WHERE id = $1`,
            [exportId, message.slice(0, 500)],
          );
        });
        throw err;
      }
    });
  }

  private async fetchReportData(
    reportType: ReportType,
    params: Record<string, unknown>,
  ): Promise<ReportData> {
    switch (reportType) {
      case 'daily-summary': {
        // Default to today in IST (UTC+5:30) when caller did not pin a date.
        const date = (params['date'] as string) ??
          new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return this.reports.getDailySummary(date);
      }
      case 'outstanding':
        return this.reports.getAllOutstanding();
      case 'customer-ltv':
        return this.reports.getCustomerLtv((params['limit'] as number) ?? 50);
      case 'loyalty-summary':
        return this.reports.getLoyaltySummary();
      case 'stock-aging':
        return this.reports.getStockAging();
      default:
        throw new Error(`reports.pdf.unknown_report_type:${reportType as string}`);
    }
  }

  // ADR-0005 forbids raw shopId params, but this method is the boundary
  // that converts a BullMQ job payload (the only carrier of tenant identity
  // for background jobs) into a real TenantContext. It cannot accept a
  // TenantContext because none exists yet at this entry point.
  // eslint-disable-next-line goldsmith/no-raw-shop-id-param
  private async buildTenantCtx(shopId: string): Promise<TenantContext> {
    const r = await this.pool.query<{
      id:           string;
      slug:         string;
      display_name: string;
      status:       Tenant['status'];
    }>(
      `SELECT id, slug, display_name, status FROM shops WHERE id = $1`,
      [shopId],
    );
    const row = r.rows[0];
    if (!row) throw new Error(`reports-pdf: shop ${shopId} not found`);
    return {
      authenticated: false,
      shopId,
      tenant: {
        id:           row.id,
        slug:         row.slug,
        display_name: row.display_name,
        status:       row.status,
      },
    };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    const data = job?.data as { exportId?: string } | undefined;
    this.logger.error(
      `reports-pdf failed: jobId=${job?.id ?? 'unknown'} exportId=${data?.exportId ?? 'unknown'} error=${error.message}`,
      error.stack,
    );
  }
}
