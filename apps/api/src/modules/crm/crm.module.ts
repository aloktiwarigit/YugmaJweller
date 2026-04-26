import { Module } from '@nestjs/common';
import { LocalKMS, DevKmsAdapter } from '@goldsmith/crypto-envelope';
import { AuthModule } from '../auth/auth.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CrmRepository } from './crm.repository';

@Module({
  imports: [AuthModule],
  controllers: [CrmController],
  providers: [
    CrmService, CrmRepository,
    {
      provide: 'KMS_ADAPTER',
      useFactory: () => { const secret = process.env['KMS_MASTER_SECRET']; return secret ? new DevKmsAdapter(secret) : new LocalKMS(); },
    },
  ],
  exports: [CrmService],
})
export class CrmModule {}