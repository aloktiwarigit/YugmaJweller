import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './reviews.repository';
import { CustomerAuthGuard } from '../customer/customer-auth.guard';

@Module({
  imports: [AuthModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository, CustomerAuthGuard],
  exports: [ReviewsService],
})
export class ReviewsModule {}
