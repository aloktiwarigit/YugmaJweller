import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { RateLockBookingsModule } from '../rate-lock-bookings/rate-lock-bookings.module';
import { TryAtHomeBookingsModule } from '../try-at-home-bookings/try-at-home-bookings.module';
import { CustomerController } from './customer.controller';
import { CustomerAuthGuard } from './customer-auth.guard';

@Module({
  imports: [
    AuthModule,
    LoyaltyModule,
    RateLockBookingsModule,
    TryAtHomeBookingsModule,
  ],
  controllers: [CustomerController],
  providers:   [CustomerAuthGuard],
})
export class CustomerModule {}
