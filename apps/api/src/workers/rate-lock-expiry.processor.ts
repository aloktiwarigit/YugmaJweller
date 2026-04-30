import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from '@goldsmith/queue';
import { RateLockBookingsService } from '../modules/rate-lock-bookings/rate-lock-bookings.service';

export const RATE_LOCK_EXPIRY_QUEUE = 'rate-lock-expiry';

@Processor(RATE_LOCK_EXPIRY_QUEUE)
export class RateLockExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(RateLockExpiryProcessor.name);

  constructor(
    @Inject(RateLockBookingsService) private readonly svc: RateLockBookingsService,
  ) {
    super();
  }

  async process(_job: Job): Promise<{ expired: number }> {
    const count = await this.svc.expireStaleBookings();
    if (count > 0) {
      this.logger.log(`rate-lock expiry sweep: expired ${count} booking(s)`);
    }
    return { expired: count };
  }
}
