import {
  Module,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Logger,
} from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Redis } from '@goldsmith/cache';
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

// ---------------------------------------------------------------------------
// IST trading hours cron patterns (UTC+5:30)
// Note: cron pattern '3-11' fires from 03:00 UTC (= 08:30 IST), 30 min before IBJA's
// 09:00 IST open. Pre-market fetches are harmless — stub/real adapter returns current rate.
//
// Three mutually exclusive patterns:
//   Trading hours   — every 15 min, Mon–Fri, UTC hours 03:00–11:59 (08:30–17:29 IST)
//   Weekend midday  — every hour at :00, Sat+Sun, UTC hours 03:00–11:59 (08:30–17:29 IST)
//   Outside hours   — every hour at :00, UTC hours 12–23 and 0–2 (daily incl. weekends)
//
// The patterns share no overlap:
//   TRADING_HOURS_CRON covers hours 3–11 on weekdays only.
//   WEEKEND_MIDDAY_CRON covers hours 3–11 on weekends only (was previously a gap — no refresh for ~8 hrs IST).
//   OUTSIDE_HOURS_CRON covers hours 12–23 and 0–2 every day (weekday+weekend hours 3–11 are absent).
// ---------------------------------------------------------------------------
const TRADING_HOURS_CRON  = '*/15 3-11 * * 1-5';      // every 15 min, Mon–Fri, UTC 03:00–11:59
const WEEKEND_MIDDAY_CRON = '0 3-11 * * 0,6';         // every hour at :00, Sat+Sun, UTC 03:00–11:59
const OUTSIDE_HOURS_CRON  = '0 12-23,0-2 * * *';      // every hour at :00, UTC 12–23 and 0–2, daily

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
      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
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
    PricingService,
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
    // Register repeatable jobs — best-effort: Redis may be transiently unavailable at boot
    try {
      await this.queue.upsertJobScheduler(
        'refresh-trading-hours',
        { pattern: TRADING_HOURS_CRON, tz: 'UTC' },
        { name: 'refresh' },
      );
      await this.queue.upsertJobScheduler(
        'refresh-weekend-midday',
        { pattern: WEEKEND_MIDDAY_CRON, tz: 'UTC' },
        { name: 'refresh' },
      );
      await this.queue.upsertJobScheduler(
        'refresh-outside-hours',
        { pattern: OUTSIDE_HOURS_CRON, tz: 'UTC' },
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
