import { Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { Redis } from '@goldsmith/cache';
import { AuthModule } from '../auth/auth.module';
import { TenantLookupModule } from '../tenant-lookup/tenant-lookup.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SettingsRepository } from './settings.repository';
import { BlobStorageService } from './blob-storage.service';
import { SettingsCache } from '@goldsmith/tenant-config';

@Module({
  imports: [AuthModule, TenantLookupModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    SettingsRepository,
    BlobStorageService,
    {
      provide: 'SETTINGS_REDIS',
      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
    },
    {
      provide: SettingsCache,
      useFactory: (redis: Redis) => new SettingsCache(redis, 60),
      inject: ['SETTINGS_REDIS'],
    },
  ],
})
export class SettingsModule implements OnModuleDestroy {
  constructor(@Inject('SETTINGS_REDIS') private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
