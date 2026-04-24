import { Inject, Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { auditLog, AuditAction } from '@goldsmith/audit';
import type { StoragePort } from '@goldsmith/integrations-storage';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import { BulkImportRowSchema } from '@goldsmith/shared';
import type { BulkImportJobStatus } from '@goldsmith/shared';
import { InventoryRepository } from './inventory.repository';
import type { CreateProductInput } from './inventory.repository';

export interface BulkImportJobData {
  jobId: string;
  storageKey: string;
  idempotencyKey: string;
  userId: string;
}

interface InvalidRow {
  rowNumber: number;
  rawRow: Record<string, string>;
  errors: string[];
}

function buildErrorCsv(
  invalidRows: InvalidRow[],
  dbFailedRows: Array<{ rowNumber: number; row: CreateProductInput; error: string }>,
): Buffer {
  const lines: string[] = ['row_number,sku,errors'];
  for (const r of invalidRows) {
    const sku = r.rawRow['sku'] ?? '';
    const errors = r.errors.join('; ').replace(/"/g, '""');
    lines.push(`${r.rowNumber},"${sku}","${errors}"`);
  }
  for (const r of dbFailedRows) {
    const sku = r.row.sku.replace(/"/g, '""');
    const error = r.error.replace(/"/g, '""');
    lines.push(`${r.rowNumber},"${sku}","${error}"`);
  }
  return Buffer.from(lines.join('\n'), 'utf8');
}

@Injectable()
export class InventoryBulkImportProcessor {
  constructor(
    @Inject(InventoryRepository) private readonly repo: InventoryRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject('PG_POOL') private readonly pool: Pool,
    @Inject('INVENTORY_REDIS') private readonly redis: Redis,
  ) {}

  async handle(data: BulkImportJobData): Promise<void> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const iKey = `idempotency:bulk-import:${data.idempotencyKey}`;

    const cached = await this.redis.get(iKey);
    if (cached) {
      const prev = JSON.parse(cached) as BulkImportJobStatus;
      // Only short-circuit on a completed result — not on the in-progress placeholder
      if (prev.status === 'completed' || prev.status === 'failed') {
        await this.redis.hset(`bulk-import:${data.jobId}`, prev as unknown as Record<string, string | number>);
        return;
      }
    }

    await this.redis.hset(`bulk-import:${data.jobId}`, {
      jobId: data.jobId, status: 'processing', total: 0, processed: 0, succeeded: 0, failed: 0,
    });

    try {
      await this.processImport(ctx, data, iKey);
    } catch (err) {
      const failedStatus: BulkImportJobStatus = {
        jobId: data.jobId,
        status: 'failed',
        total: 0, processed: 0, succeeded: 0, failed: 0,
      };
      await this.redis.hset(`bulk-import:${data.jobId}`, failedStatus as unknown as Record<string, string | number>);
      // Clear placeholder so retries can reprocess
      await this.redis.del(iKey);
      throw err;
    }
  }

  private async processImport(
    ctx: AuthenticatedTenantContext,
    data: BulkImportJobData,
    iKey: string,
  ): Promise<void> {
    // Set in-progress idempotency marker (cleared on failure, replaced with result on success)
    await this.redis.set(iKey, JSON.stringify({ jobId: data.jobId, status: 'processing' }), 'EX', 86400);

    const buf = await this.storage.downloadBuffer(data.storageKey);

    const validRows: CreateProductInput[] = [];
    const invalidRows: InvalidRow[] = [];
    let rowNumber = 0;

    // Collect unique category names for batch lookup
    const categoryNames = new Set<string>();
    const rawRows: Array<{ rowNumber: number; raw: Record<string, string> }> = [];

    const readable = Readable.from(buf);
    const parser = readable.pipe(parse({ columns: true, skip_empty_lines: true, trim: true }));

    for await (const raw of parser as AsyncIterable<Record<string, string>>) {
      rowNumber++;
      const parsed = BulkImportRowSchema.safeParse(raw);
      if (!parsed.success) {
        invalidRows.push({
          rowNumber,
          rawRow: raw,
          errors: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        });
        continue;
      }
      categoryNames.add(parsed.data.category);
      rawRows.push({ rowNumber, raw });
    }

    // Resolve category names → UUIDs (one lookup per unique name)
    const categoryIdMap = new Map<string, string | null>();
    for (const name of categoryNames) {
      const id = await this.repo.findCategoryByName(name);
      categoryIdMap.set(name, id);
    }

    // Build CreateProductInput for valid rows
    for (const { rowNumber: rn, raw } of rawRows) {
      const parsed = BulkImportRowSchema.safeParse(raw);
      if (!parsed.success) continue; // already collected above
      const r = parsed.data;
      validRows.push({
        shopId: ctx.shopId,
        createdByUserId: data.userId,
        categoryId: categoryIdMap.get(r.category) ?? undefined,
        sku: r.sku,
        metal: r.metal,
        purity: r.purity,
        grossWeightG: r.gross_weight,
        netWeightG: r.net_weight,
        stoneWeightG: r.stone_weight,
        stoneDetails: r.stone_details,
        makingChargeOverridePct: r.making_charge_override,
        huid: r.huid,
      });
      void rn; // rowNumber used for ordering; valid rows tracked by position
    }

    const total = rowNumber;
    await this.redis.hset(`bulk-import:${data.jobId}`, {
      total, processed: 0, succeeded: 0, failed: invalidRows.length,
    });

    let dbSucceeded = 0;
    const dbFailedRows: Array<{ rowNumber: number; row: CreateProductInput; error: string }> = [];
    if (validRows.length > 0) {
      const result = await this.repo.createMany(validRows);
      dbSucceeded = result.succeeded;
      dbFailedRows.push(...result.failedRows);
    }

    let errorFileUrl: string | undefined;
    if (invalidRows.length > 0 || dbFailedRows.length > 0) {
      const errKey = `tenants/${ctx.shopId}/bulk-import/${data.jobId}/errors.csv`;
      const errBuf = buildErrorCsv(invalidRows, dbFailedRows);
      await this.storage.uploadBuffer(errKey, errBuf, 'text/csv');
      errorFileUrl = await this.storage.getPresignedReadUrl(errKey);
    }

    const totalFailed = invalidRows.length + dbFailedRows.length;
    const finalStatus: BulkImportJobStatus = {
      jobId: data.jobId,
      status: 'completed',
      total,
      processed: total,
      succeeded: dbSucceeded,
      failed: totalFailed,
      errorFileUrl,
    };

    await this.redis.hset(`bulk-import:${data.jobId}`, finalStatus as unknown as Record<string, string | number>);
    await this.redis.set(iKey, JSON.stringify(finalStatus), 'EX', 86400);

    void auditLog(this.pool, {
      action: AuditAction.INVENTORY_BULK_IMPORT_COMPLETED,
      subjectType: 'bulk_import',
      subjectId: data.jobId,
      actorUserId: data.userId,
      after: { succeeded: dbSucceeded, failed: totalFailed, total },
    }).catch(() => undefined);
  }
}
