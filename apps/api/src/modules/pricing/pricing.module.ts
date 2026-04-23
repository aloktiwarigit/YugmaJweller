import {
  Module,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
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
// 09:00–17:30 IST = 03:30–12:00 UTC
// Every 15 min during trading hours: */15 3-11 * * 1-5 + 30 12 (for 12:30 UTC = 18:00 IST, outside trading)
// Every 60 min outside trading hours
// ---------------------------------------------------------------------------
const TRADING_HOURS_CRON = '*/15 3-11 * * 1-5';   // 09:00–17:45 IST (Mon–Fri)
const OUTSIDE_HOURS_CRON = '0 * * * *';             // Every hour, every day

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
    // Register repeatable jobs — upsert so restarts are idempotent
    await this.queue.upsertJobScheduler(
      'refresh-trading-hours',
      { pattern: TRADING_HOURS_CRON },
      { name: 'refresh' },
    );

    await this.queue.upsertJobScheduler(
      'refresh-outside-hours',
      { pattern: OUTSIDE_HOURS_CRON },
      { name: 'refresh' },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
