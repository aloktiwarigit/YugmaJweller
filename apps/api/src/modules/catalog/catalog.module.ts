import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [PricingModule, AnalyticsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
