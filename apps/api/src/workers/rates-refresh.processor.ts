import { Logger, Inject } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from '@goldsmith/queue';
import type { Pool } from 'pg';
import { AuditAction } from '@goldsmith/audit';
import { PricingService } from '../modules/pricing/pricing.service';

@Processor('rates-refresh')
export class RatesRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(RatesRefreshProcessor.name);

  constructor(
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'refresh') {
      this.logger.log(`Processing rates-refresh job id=${job.id}`);
      await this.pricingService.refreshRates();
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `rates-refresh job failed: jobId=${job?.id ?? 'unknown'} name=${job?.name ?? 'unknown'} error=${error.message}`,
      error.stack,
    );
    // Persist PRICING_RATES_FALLBACK audit event to DB (best-effort, async).
    // Wrapped in void + try/catch so an audit DB failure never masks the original job failure.
    void (async () => {
      try {
        const client = await this.pool.connect();
        try {
          await client.query(
            `INSERT INTO platform_audit_events (action, metadata)
             VALUES ($1, $2)`,
            [
              AuditAction.PRICING_RATES_FALLBACK,
              JSON.stringify({
                jobId: job?.id ?? 'unknown',
                jobName: job?.name ?? 'unknown',
                error: error.message,
              }),
            ],
          );
        } finally {
          client.release();
        }
      } catch (auditErr) {
        this.logger.warn(
          `Failed to persist PRICING_RATES_FALLBACK audit event: ${(auditErr as Error).message}`,
        );
      }
    })();
  }
}
