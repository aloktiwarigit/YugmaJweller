import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from '@goldsmith/queue';

export const SALES_AND_VIEWS_ROLLUP_QUEUE = 'sales-and-views-rollup';
export interface SalesAndViewsRollupJobData { shopId: string }

// B7 stub — full implementation deferred until first paying SOW.
// At demo scale (≤20 seeded products, no real transactions) this rollup
// produces zeros; seed data sets sales_count_30d/view_count_30d directly.
@Processor(SALES_AND_VIEWS_ROLLUP_QUEUE)
export class SalesAndViewsRollupProcessor extends WorkerHost {
  private readonly logger = new Logger(SalesAndViewsRollupProcessor.name);

  async process(job: Job<SalesAndViewsRollupJobData>): Promise<void> {
    this.logger.debug(`sales-and-views-rollup stub: shopId=${job.data.shopId} — no-op until SOW`);
  }
}
