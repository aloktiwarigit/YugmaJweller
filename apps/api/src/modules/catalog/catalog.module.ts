import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { StorageModule } from '@goldsmith/integrations-storage';
import { SettingsRepository } from '../settings/settings.repository';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [AuthModule, PricingModule, AnalyticsModule, StorageModule],
  controllers: [CatalogController],
  providers: [CatalogService, SettingsRepository],
  exports: [CatalogService],
})
export class CatalogModule {}
