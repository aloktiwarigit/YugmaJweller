import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffRepository } from './staff.repository';

@Module({
  imports: [AuthModule],
  controllers: [StaffController],
  providers: [StaffService, StaffRepository],
})
export class StaffModule {}
