import { Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { Redis } from '@goldsmith/cache';
import { createPool } from '@goldsmith/db';
import { SyncLogger } from '@goldsmith/sync';
import { AuthModule } from '../auth/auth.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [AuthModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    SyncLogger,
    {
      provide: 'SYNC_POOL',
      useFactory: () =>
        createPool({ connectionString: process.env['DATABASE_URL'] ?? 'postgresql://localhost/goldsmith' }),
    },
    {
      provide: 'SYNC_REDIS',
      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
    },
  ],
  exports: [SyncService, SyncLogger],
})
export class SyncModule implements OnModuleDestroy {
  constructor(@Inject('SYNC_REDIS') private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
