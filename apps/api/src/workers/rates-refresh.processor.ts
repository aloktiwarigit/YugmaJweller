import { Logger, Inject } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { AuditAction } from '@goldsmith/audit';
import { PricingService } from '../modules/pricing/pricing.service';

@Processor('rates-refresh')
export class RatesRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(RatesRefreshProcessor.name);

  constructor(
    @Inject(PricingService) private readonly pricingService: PricingService,
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
    // Fire-and-forget platform audit event for PRICING_RATES_FALLBACK
    // We log to the logger; the DB insert is best-effort here since we cannot inject pool
    // cleanly into the event handler decorator — the main refreshRates() already logs
    // PRICING_RATES_REFRESHED on success; failures are observable via Sentry/logger.
    this.logger.warn(
      `Audit: ${AuditAction.PRICING_RATES_FALLBACK} — rates-refresh job failed; all sources exhausted`,
    );
  }
}
