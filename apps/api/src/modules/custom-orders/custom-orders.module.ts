import { Module } from '@nestjs/common';
import { StorageModule } from '@goldsmith/integrations-storage';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { CustomOrdersController } from './custom-orders.controller';
import { CustomOrdersService } from './custom-orders.service';
import { CustomOrdersRepository } from './custom-orders.repository';

@Module({
  imports: [
    AuthModule,     // provides + exports PG_POOL
    StorageModule,  // provides STORAGE_PORT
    BillingModule,  // provides BillingService + PAYMENTS_ADAPTER
  ],
  controllers: [CustomOrdersController],
  providers: [CustomOrdersService, CustomOrdersRepository],
  exports: [CustomOrdersService],
})
export class CustomOrdersModule {}
