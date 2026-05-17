import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Redis } from '@goldsmith/cache';
import { RazorpayAdapter, StubPaymentsAdapter } from '@goldsmith/integrations-payments';
import { AuthModule }    from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { RateLockBookingsController } from './rate-lock-bookings.controller';
import { RateLockBookingsService }    from './rate-lock-bookings.service';
import { RateLockExpiryProcessor, RATE_LOCK_EXPIRY_QUEUE } from '../../workers/rate-lock-expiry.processor';

export function createRateLockPaymentsAdapter(): RazorpayAdapter | StubPaymentsAdapter {
  const adapter   = process.env['PAYMENTS_ADAPTER'] ?? '';
  const isProd    = process.env['NODE_ENV'] === 'production';
  const allowStub = process.env['ALLOW_STUB_PAYMENTS'] === '1';
  if (isProd && adapter !== 'razorpay' && !allowStub) {
    throw new Error(
      'PAYMENTS_ADAPTER must be "razorpay" in production. ' +
      'The stub payments adapter is only allowed in non-production environments. ' +
      'Set ALLOW_STUB_PAYMENTS=1 to opt into the stub for demo/staging deployments in production mode.',
    );
  }
  if (adapter === 'razorpay') return new RazorpayAdapter();
  return new StubPaymentsAdapter();
}

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
      useFactory: createRateLockPaymentsAdapter,
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
    try {
      await this.expiryQueue.add(
        'expire-stale',
        {},
        { repeat: { every: 15 * 60 * 1000 }, jobId: 'rate-lock-expiry-sweep' },
      );
    } catch (err) {
      new (await import('@nestjs/common')).Logger(RateLockBookingsModule.name).warn(
        `Rate-lock expiry sweep job could not be scheduled at boot — will retry on restart: ${String(err)}`,
      );
    }
  }
}
