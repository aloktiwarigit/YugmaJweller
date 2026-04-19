import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantBootController } from './tenant-boot.controller';
import { TenantBootService } from './tenant-boot.service';
import { TenantAuditReporter } from './tenant-audit-reporter';

@Module({
  imports: [AuthModule],
  controllers: [TenantBootController],
  providers: [TenantBootService, TenantAuditReporter],
  exports: [TenantAuditReporter],
})
export class TenantBootModule {}
