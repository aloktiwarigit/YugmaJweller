import {
  Module,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Logger,
} from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from '@goldsmith/queue';
import { Redis } from '@goldsmith/cache';
import type { Pool } from 'pg';
import { AuthModule } from '../auth/auth.module';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { RatesRefreshProcessor } from '../../workers/rates-refresh.processor';
import {
  FallbackChain,
  IbjaAdapter,
  MetalsDevAdapter,
  CircuitBreaker,
  LastKnownGoodCache,
} from '@goldsmith/rates';
import { areQueueWorkersEnabled } from '../../queue-runtime';
import { createRedisClient } from '../../redis-client';

// ---------------------------------------------------------------------------
// goldapi.io rate-limit budget: free tier is 100 requests/month. With three
// fixed daily refreshes we use ~93/month, leaving margin for cold-start
// fetches on instance startup. The in-memory cache in IbjaAdapter holds the
// last fetch for 9h so on-demand requests between crons return the cached
// value without making a new API call.
//
// Schedule (IST → UTC):
//   09:00 IST = 03:30 UTC
//   13:00 IST = 07:30 UTC
//   18:00 IST = 12:30 UTC
// ---------------------------------------------------------------------------
const REFRESH_MORNING_CRON  = '30 3 * * *';   // 09:00 IST daily
const REFRESH_MIDDAY_CRON   = '30 7 * * *';   // 13:00 IST daily
const REFRESH_EVENING_CRON  = '30 12 * * *';  // 18:00 IST daily

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({ name: 'rates-refresh' }),
  ],
  providers: [
    // PG Pool — reuse the one exported from AuthModule (injected by token)
    // We use 'PG_POOL' which is provided and exported by AuthModule
    {
      provide: 'PRICING_REDIS',
      useFactory: () => createRedisClient('pricing'),
    },
    {
      provide: LastKnownGoodCache,
      useFactory: (redis: Redis) => new LastKnownGoodCache(redis),
      inject: ['PRICING_REDIS'],
    },
    {
      provide: IbjaAdapter,
      useFactory: () => new IbjaAdapter(),
    },
    {
      provide: MetalsDevAdapter,
      useFactory: () => new MetalsDevAdapter(),
    },
    {
      provide: 'IBJA_WITH_CB',
      useFactory: (ibja: IbjaAdapter, redis: Redis) => new CircuitBreaker(ibja, redis),
      inject: [IbjaAdapter, 'PRICING_REDIS'],
    },
    {
      provide: 'METALSDEV_WITH_CB',
      useFactory: (metalsdev: MetalsDevAdapter, redis: Redis) => new CircuitBreaker(metalsdev, redis),
      inject: [MetalsDevAdapter, 'PRICING_REDIS'],
    },
    {
      provide: FallbackChain,
      useFactory: (
        ibja: CircuitBreaker,
        metalsdev: CircuitBreaker,
        lkg: LastKnownGoodCache,
      ) => new FallbackChain(ibja, metalsdev, lkg, console),
      inject: ['IBJA_WITH_CB', 'METALSDEV_WITH_CB', LastKnownGoodCache],
    },
    {
      provide: PricingService,
      useFactory: (pool: Pool, fallbackChain: FallbackChain, redis: Redis) =>
        new PricingService(pool, fallbackChain, redis),
      inject: ['PG_POOL', FallbackChain, 'PRICING_REDIS'],
    },
    RatesRefreshProcessor,
  ],
  controllers: [PricingController],
  exports: [PricingService],
})
export class PricingModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectQueue('rates-refresh') private readonly queue: Queue,
    @Inject('PRICING_REDIS') private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!areQueueWorkersEnabled()) return;
    // Register repeatable jobs — best-effort: Redis may be transiently unavailable at boot.
    // Best-effort cleanup of legacy job schedulers from the high-frequency cron era
    // (every-15-min + hourly = ~80/day). The IDs are kept short for log readability.
    try {
      for (const legacy of ['refresh-trading-hours', 'refresh-weekend-midday', 'refresh-outside-hours']) {
        await this.queue.removeJobScheduler(legacy).catch(() => undefined);
      }
      await this.queue.upsertJobScheduler(
        'refresh-morning-ist',
        { pattern: REFRESH_MORNING_CRON, tz: 'UTC' },
        { name: 'refresh' },
      );
      await this.queue.upsertJobScheduler(
        'refresh-midday-ist',
        { pattern: REFRESH_MIDDAY_CRON, tz: 'UTC' },
        { name: 'refresh' },
      );
      await this.queue.upsertJobScheduler(
        'refresh-evening-ist',
        { pattern: REFRESH_EVENING_CRON, tz: 'UTC' },
        { name: 'refresh' },
      );
    } catch (err) {
      new Logger(PricingModule.name).warn(`Rate refresh job schedulers could not be registered at boot — will retry on next restart: ${String(err)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
