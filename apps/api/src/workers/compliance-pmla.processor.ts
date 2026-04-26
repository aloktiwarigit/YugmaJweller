import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from '@goldsmith/queue';

// PmlaCashThresholdWarningJob will be exported from payment.service in Story 5.5.
// Stubbed here so the BullMQ processor is registered; type refined when Story 5.5 lands.
interface PmlaCashThresholdWarningJob {
  shopId: string;
  cumulativePaise: string;
  monthStr: string;
}

@Processor('compliance-pmla')
export class CompliancePmlaProcessor extends WorkerHost {
  private readonly logger = new Logger(CompliancePmlaProcessor.name);

  async process(job: Job<PmlaCashThresholdWarningJob>): Promise<void> {
    if (job.name === 'cash-threshold-warning') {
      const { shopId, cumulativePaise, monthStr } = job.data;
      // Stub for Epic 13 push notification.
      // When Epic 13 lands, this sends an in-app + WhatsApp alert to the shopkeeper.
      this.logger.log(
        `PMLA cash threshold warning: shopId=${shopId} cumulative=₹${(BigInt(cumulativePaise) / 100n).toString()} month=${monthStr}`,
      );
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `compliance-pmla job failed: jobId=${job?.id ?? 'unknown'} name=${job?.name ?? 'unknown'} error=${error.message}`,
      error.stack,
    );
  }
}
