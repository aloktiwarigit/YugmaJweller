import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { WishlistRepository } from './wishlist.repository';
import { CustomerAuthGuard } from '../customer/customer-auth.guard';

@Module({
  imports: [AuthModule],
  controllers: [WishlistController],
  providers: [WishlistService, WishlistRepository, CustomerAuthGuard],
  exports: [WishlistService],
})
export class WishlistModule {}
