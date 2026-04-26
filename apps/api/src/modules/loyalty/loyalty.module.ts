import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { Redis } from '@goldsmith/cache';
import { SettingsCache } from '@goldsmith/tenant-config';
import { AuthModule } from '../auth/auth.module';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyRepository } from './loyalty.repository';
import { LoyaltyEventListener, LOYALTY_ACCRUAL_QUEUE } from './loyalty.event-listener';
import { LoyaltyAccrualProcessor } from '../../workers/loyalty-accrual.processor';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: LOYALTY_ACCRUAL_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 }, // 30s, 60s, 120s
        removeOnComplete: { age: 60 * 60 * 24 * 7 },
        removeOnFail:     { age: 60 * 60 * 24 * 30 },
      },
    }),
  ],
  providers: [
    LoyaltyService,
    LoyaltyRepository,
    LoyaltyEventListener,
    LoyaltyAccrualProcessor,
    {
      provide: 'LOYALTY_REDIS',
      useFactory: () =>
        new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 3,
        }),
    },
    {
      provide: SettingsCache,
      useFactory: (redis: Redis) => new SettingsCache(redis, 60),
      inject: ['LOYALTY_REDIS'],
    },
  ],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
