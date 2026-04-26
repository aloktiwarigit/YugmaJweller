import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from '@goldsmith/queue';
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
  ) {
    super();
  }

  async process(job: Job<GstrExportJob>): Promise<{ storageKey: string }> {
    const { shopId, month, type } = job.data;
    this.logger.log(`GSTR export: shopId=${shopId} month=${month} type=${type}`);

    const csv = type === 'gstr1'
      ? await this.gstrSvc.generateGstr1Csv(month)
      : await this.gstrSvc.generateGstr3bSummary(month);

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
}
