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
// goldapi.io rate-limit budget: free tier is 100 requests/month.
// Each refresh = 2 API calls (XAU/INR + XAG/INR fetched in parallel).
// 1 cron/day × 2 calls × 31 days = 62 scheduled calls/month, leaving ~38
// for cold-start fetches across Cloud Run instances. The 9h in-memory cache
// covers the full day between crons so on-demand catalog/rates requests never
// hit the API. IbjaAdapter.clearCache() is called by the processor before
// each cron job so the daily refresh always fetches fresh data.
//
// Schedule (IST → UTC):  09:00 IST = 03:30 UTC
// ---------------------------------------------------------------------------
const REFRESH_DAILY_CRON = '30 3 * * *';   // 09:00 IST daily

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
      for (const legacy of [
        'refresh-trading-hours', 'refresh-weekend-midday', 'refresh-outside-hours',
        'refresh-midday-ist', 'refresh-evening-ist',
      ]) {
        await this.queue.removeJobScheduler(legacy).catch(() => undefined);
      }
      await this.queue.upsertJobScheduler(
        'refresh-morning-ist',
        { pattern: REFRESH_DAILY_CRON, tz: 'UTC' },
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
