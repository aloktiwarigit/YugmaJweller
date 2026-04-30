import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Redis } from '@goldsmith/cache';
import { RazorpayAdapter, StubPaymentsAdapter } from '@goldsmith/integrations-payments';
import { Queue } from '@goldsmith/queue';
import { AuthModule }    from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { RateLockBookingsController } from './rate-lock-bookings.controller';
import { RateLockBookingsService }    from './rate-lock-bookings.service';
import { RateLockExpiryProcessor, RATE_LOCK_EXPIRY_QUEUE } from '../../workers/rate-lock-expiry.processor';

@Module({
  imports: [
    AuthModule,
    PricingModule,
    BullModule.registerQueue({
      name: RATE_LOCK_EXPIRY_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: { age: 60 * 60 * 24 },
        removeOnFail:     { age: 60 * 60 * 24 * 7 },
      },
    }),
  ],
  controllers: [RateLockBookingsController],
  providers: [
    RateLockBookingsService,
    RateLockExpiryProcessor,
    {
      provide: 'RATE_LOCK_PAYMENTS_ADAPTER',
      useFactory: () => {
        const adapter = process.env['PAYMENTS_ADAPTER'] ?? 'stub';
        if (adapter === 'razorpay') return new RazorpayAdapter();
        if (process.env['NODE_ENV'] === 'production') {
          throw new Error('PAYMENTS_ADAPTER must be set to "razorpay" in production.');
        }
        return new StubPaymentsAdapter();
      },
    },
    {
      provide: 'RATE_LOCK_REDIS',
      useFactory: () =>
        new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 3,
        }),
    },
  ],
  exports: [RateLockBookingsService],
})
export class RateLockBookingsModule implements OnModuleInit {
  constructor(
    @InjectQueue(RATE_LOCK_EXPIRY_QUEUE) private readonly expiryQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.expiryQueue.add(
      'expire-stale',
      {},
      { repeat: { every: 15 * 60 * 1000 }, jobId: 'rate-lock-expiry-sweep' },
    );
  }
}
