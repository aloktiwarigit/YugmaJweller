import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SettingsRepository } from '../settings/settings.repository';
import { TryAtHomeBookingsController } from './try-at-home-bookings.controller';
import { TryAtHomeBookingsService } from './try-at-home-bookings.service';
import { TryAtHomeBookingsRepository } from './try-at-home-bookings.repository';

@Module({
  imports: [
    AuthModule,       // provides + exports PG_POOL
    BillingModule,    // provides BillingService
    InventoryModule,  // provides InventoryService
  ],
  controllers: [TryAtHomeBookingsController],
  providers: [
    TryAtHomeBookingsService,
    TryAtHomeBookingsRepository,
    SettingsRepository,
  ],
  exports: [TryAtHomeBookingsService],
})
export class TryAtHomeBookingsModule {}
