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
      useFactory: () => {
        const secret = process.env['KMS_MASTER_SECRET'];
        if (process.env['NODE_ENV'] === 'production' && !process.env['AZURE_KEY_VAULT_URL']) {
          throw new Error(
            'Production requires AZURE_KEY_VAULT_URL. ' +
            'LocalKMS is ephemeral and must not run in production.',
          );
        }
        return secret ? new DevKmsAdapter(secret) : new LocalKMS();
      },
    },
  ],
  exports: [CrmService],
})
export class CrmModule {}