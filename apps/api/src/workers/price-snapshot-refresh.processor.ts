import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from '@goldsmith/queue';

export const PRICE_SNAPSHOT_REFRESH_QUEUE = 'price-snapshot-refresh';
export interface PriceSnapshotJobData { shopId: string }

// B7 stub — full implementation deferred until first paying SOW.
// Triggers (pricing.service after setCurrentRates, inventory.service after
// product save) can safely enqueue; this processor acknowledges without
// running the UPDATE so no-op costs nothing at demo scale.
@Processor(PRICE_SNAPSHOT_REFRESH_QUEUE)
export class PriceSnapshotRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(PriceSnapshotRefreshProcessor.name);

  async process(job: Job<PriceSnapshotJobData>): Promise<void> {
    this.logger.debug(`price-snapshot-refresh stub: shopId=${job.data.shopId} — no-op until SOW`);
  }
}
