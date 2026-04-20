import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';

@Module({
  imports: [AuthModule],
  providers: [DrizzleTenantLookup],
  exports: [DrizzleTenantLookup],
})
export class TenantLookupModule {}
