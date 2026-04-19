import { Module } from '@nestjs/common';
import Redis from 'ioredis';
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
      provide: SettingsCache,
      useFactory: () =>
        new SettingsCache(
          new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
          60,
        ),
    },
  ],
})
export class SettingsModule {}
