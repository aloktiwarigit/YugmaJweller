import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CrmModule } from '../crm/crm.module';
import { CustomOrdersModule } from '../custom-orders/custom-orders.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { RateLockBookingsModule } from '../rate-lock-bookings/rate-lock-bookings.module';
import { TryAtHomeBookingsModule } from '../try-at-home-bookings/try-at-home-bookings.module';
import { CustomerController } from './customer.controller';
import { PaymentController } from './payment.controller';
import { CustomerAuthGuard } from './customer-auth.guard';

@Module({
  imports: [
    AuthModule,
    CrmModule,
    CustomOrdersModule,
    LoyaltyModule,
    RateLockBookingsModule,
    TryAtHomeBookingsModule,
  ],
  controllers: [CustomerController, PaymentController],
  providers:   [CustomerAuthGuard],
})
export class CustomerModule {}
