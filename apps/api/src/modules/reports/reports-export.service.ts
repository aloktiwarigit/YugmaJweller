import {
  BadRequestException, ConflictException, Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { withTenantTx } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import { auditLog, AuditAction } from '@goldsmith/audit';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import type { StoragePort } from '@goldsmith/integrations-storage';
import type { ReportType } from './pdf/renderer';

const VALID_REPORT_TYPES: ReportType[] = [
  'daily-summary', 'outstanding', 'customer-ltv', 'loyalty-summary', 'stock-aging',
];

const BLOB_RETENTION_DAYS = 7;

export interface ExportEnqueueParams {
  date?: string;
  limit?: number;
  page?: number;
}

export interface ExportStatusResult {
  id:             string;
  reportType:     ReportType;
  status:         'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
  downloadUrl?:   string;
  blobExpiresAt?: string;
  errorMessage?:  string;
}

interface ExportRow {
  id:             string;
  report_type:    ReportType;
  status:         'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
  storage_key:    string | null;
  error_message:  string | null;
  created_at:     Date;
  params:         ExportEnqueueParams;
}

@Injectable()
export class ReportsExportService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    @InjectQueue('reports-pdf') private readonly queue: Queue,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async enqueue(reportType: ReportType, params: ExportEnqueueParams): Promise<{ id: string; status: 'QUEUED' }> {
    if (!VALID_REPORT_TYPES.includes(reportType)) {
      throw new BadRequestException({ code: 'reports.export.invalid_report_type' });
    }
    const ctx = tenantContext.requireCurrent();
    if (!ctx.authenticated) {
      throw new BadRequestException({ code: 'reports.export.unauthenticated' });
    }
    const userId = ctx.userId;

    const id = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO reports_pdf_exports (shop_id, report_type, params, status, requested_by_user_id)
         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2::jsonb, 'QUEUED', $3)
         RETURNING id`,
        [reportType, JSON.stringify(params), userId],
      );
      return r.rows[0]!.id;
    });

    await this.queue.add('render', {
      shopId:     ctx.shopId,
      exportId:   id,
      reportType,
      params,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

    await auditLog(this.pool, {
      action: AuditAction.REPORT_EXPORT_REQUESTED,
      subjectType: 'report',
      subjectId: id,
      actorUserId: userId,
      after: { reportType, params },
    });

    return { id, status: 'QUEUED' };
  }

  async getStatus(id: string): Promise<ExportStatusResult> {
    const row = await this.fetchRow(id);
    return this.toStatusResult(row);
  }

  async regenerate(id: string): Promise<ExportStatusResult> {
    const row = await this.fetchRow(id);
    if (row.status === 'QUEUED' || row.status === 'RUNNING') {
      throw new ConflictException({ code: 'reports.export.busy' });
    }

    const ctx = tenantContext.requireCurrent();
    const userId = ctx.authenticated ? ctx.userId : undefined;

    // Try to re-sign existing blob if within retention window.
    const ageMs = Date.now() - row.created_at.getTime();
    const withinRetention = ageMs < BLOB_RETENTION_DAYS * 86400_000 && row.storage_key !== null;

    if (withinRetention) {
      try {
        await this.storage.downloadBuffer(row.storage_key!); // probes blob existence
        await auditLog(this.pool, {
          action: AuditAction.REPORT_EXPORT_REGENERATED,
          subjectType: 'report',
          subjectId: id,
          actorUserId: userId,
          metadata: { mode: 'resign' },
        });
        return this.toStatusResult({ ...row, status: 'READY' });
      } catch {
        // blob missing — fall through to re-render
      }
    }

    // Re-render: reset row, enqueue fresh job.
    await withTenantTx(this.pool, async (tx) => {
      await tx.query(
        `UPDATE reports_pdf_exports
         SET status = 'QUEUED',
             storage_key = NULL,
             error_message = NULL,
             completed_at = NULL,
             created_at = now()
         WHERE id = $1`,
        [id],
      );
    });
    await this.queue.add('render', {
      shopId:     ctx.shopId,
      exportId:   id,
      reportType: row.report_type,
      params:     row.params,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

    await auditLog(this.pool, {
      action: AuditAction.REPORT_EXPORT_REGENERATED,
      subjectType: 'report',
      subjectId: id,
      actorUserId: userId,
      metadata: { mode: 'rerender' },
    });

    return { id, reportType: row.report_type, status: 'QUEUED' };
  }

  private async fetchRow(id: string): Promise<ExportRow> {
    const row = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<ExportRow>(
        `SELECT id, report_type, status, storage_key, error_message, created_at, params
         FROM reports_pdf_exports
         WHERE id = $1`,
        [id],
      );
      return r.rows[0];
    });
    if (!row) throw new NotFoundException({ code: 'reports.export.not_found' });
    return row;
  }

  private async toStatusResult(row: ExportRow): Promise<ExportStatusResult> {
    const result: ExportStatusResult = {
      id:         row.id,
      reportType: row.report_type,
      status:     row.status,
    };
    if (row.error_message) result.errorMessage = row.error_message;
    if (row.status === 'READY' && row.storage_key) {
      const ageMs = Date.now() - row.created_at.getTime();
      const blobExpiresAt = new Date(row.created_at.getTime() + BLOB_RETENTION_DAYS * 86400_000);
      if (ageMs < BLOB_RETENTION_DAYS * 86400_000) {
        result.downloadUrl = await this.storage.getPresignedReadUrl(row.storage_key);
      }
      result.blobExpiresAt = blobExpiresAt.toISOString();
    }
    return result;
  }
}
