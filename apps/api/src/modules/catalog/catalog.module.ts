import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [PricingModule, AnalyticsModule],
  controllers: [CatalogController],
})
export class CatalogModule {}
