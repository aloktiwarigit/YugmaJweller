import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { tenantContext } from '@goldsmith/tenant-context';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import type { StoragePort } from '@goldsmith/integrations-storage';
import { STORAGE_PORT } from '@goldsmith/integrations-storage';
import type { TenantQueue } from '@goldsmith/queue';
import type { BulkImportJobStatus } from '@goldsmith/shared';
import type { BulkImportJobData } from './inventory.bulk-import.processor';

interface BulkImportMeta {
  shopId: string;
  storageKey: string;
  idempotencyKey: string;
}

@Injectable()
export class InventoryBulkImportService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject('INVENTORY_REDIS') private readonly redis: Redis,
    @Inject('BULK_IMPORT_QUEUE') private readonly queue: TenantQueue<BulkImportJobData>,
  ) {}

  async createUploadUrl(idempotencyKey: string): Promise<{ uploadUrl: string; jobId: string }> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const jobId = randomUUID();
    const storageKey = `tenants/${ctx.shopId}/bulk-import/${jobId}/input.csv`;
    const uploadUrl = await this.storage.getPresignedUploadUrl(storageKey, 'text/csv');

    const meta: BulkImportMeta = { shopId: ctx.shopId, storageKey, idempotencyKey };
    await this.redis.set(`bulk-import-meta:${jobId}`, JSON.stringify(meta), 'EX', 3600);
    await this.redis.hset(`bulk-import:${jobId}`, {
      jobId, status: 'pending', total: 0, processed: 0, succeeded: 0, failed: 0,
    });

    return { uploadUrl, jobId };
  }

  async triggerJob(jobId: string, userId: string): Promise<{ jobId: string; message: string }> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const raw = await this.redis.get(`bulk-import-meta:${jobId}`);
    if (!raw) throw new NotFoundException({ code: 'inventory.bulk_import_job_not_found' });

    const meta = JSON.parse(raw) as BulkImportMeta;
    if (meta.shopId !== ctx.shopId) throw new NotFoundException({ code: 'inventory.bulk_import_job_not_found' });

    const jobData: BulkImportJobData = {
      jobId,
      storageKey: meta.storageKey,
      idempotencyKey: meta.idempotencyKey,
      userId,
    };

    await this.queue.add(ctx, 'import', jobData, { jobId });

    return { jobId, message: 'Import started' };
  }

  async getJobStatus(jobId: string): Promise<BulkImportJobStatus> {
    const ctx = tenantContext.requireCurrent() as AuthenticatedTenantContext;
    const raw = await this.redis.get(`bulk-import-meta:${jobId}`);
    // Return 404 if job belongs to a different tenant (leak-proof: same response as "not found")
    if (!raw) throw new NotFoundException({ code: 'inventory.bulk_import_job_not_found' });
    const meta = JSON.parse(raw) as BulkImportMeta;
    if (meta.shopId !== ctx.shopId) throw new NotFoundException({ code: 'inventory.bulk_import_job_not_found' });

    const hash = await this.redis.hgetall(`bulk-import:${jobId}`);
    if (!hash || Object.keys(hash).length === 0) {
      throw new NotFoundException({ code: 'inventory.bulk_import_job_not_found' });
    }
    return {
      jobId: hash['jobId'] ?? jobId,
      status: (hash['status'] ?? 'pending') as BulkImportJobStatus['status'],
      total:     Number(hash['total']     ?? 0),
      processed: Number(hash['processed'] ?? 0),
      succeeded: Number(hash['succeeded'] ?? 0),
      failed:    Number(hash['failed']    ?? 0),
      errorFileUrl: hash['errorFileUrl'] || undefined,
    };
  }
}
