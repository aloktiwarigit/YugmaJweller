import { Logger, Inject } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from '@goldsmith/queue';
import { InventorySearchService } from '../modules/inventory/inventory.search.service';

export interface SearchIndexerJobData {
  shopId: string;
  productId: string;
  operation: 'index' | 'remove';
}

@Processor('search-indexer')
export class SearchIndexerProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchIndexerProcessor.name);

  constructor(
    @Inject(InventorySearchService) private readonly searchSvc: InventorySearchService,
  ) {
    super();
  }

  async process(job: Job<SearchIndexerJobData>): Promise<void> {
    const { shopId, productId, operation } = job.data;
    this.logger.log(
      `search-indexer: jobId=${job.id} op=${operation} productId=${productId} shopId=${shopId}`,
    );
    if (operation === 'index') {
      await this.searchSvc.indexProduct(shopId, productId);
    } else if (operation === 'remove') {
      await this.searchSvc.removeFromIndex(shopId, productId);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `search-indexer job failed: jobId=${job?.id ?? 'unknown'} error=${error.message}`,
      error.stack,
    );
  }
}
