import {
  Module,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { LocalKMS, DevKmsAdapter } from '@goldsmith/crypto-envelope';
import { SearchModule } from '@goldsmith/integrations-search';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { CustomerAuthGuard } from '../customer/customer-auth.guard';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CrmRepository } from './crm.repository';
import { CrmSearchService } from './crm-search.service';
import { FamilyService } from './family.service';
import { FamilyRepository } from './family.repository';
import { HistoryService } from './history.service';
import { BalanceService } from './balance.service';
import { NotesService } from './notes.service';
import { OccasionsService } from './occasions.service';
import { OccasionReminderProcessor } from '../../workers/occasion-reminder.processor';
import { DpdpaDeletionService, DPDPA_HARD_DELETE_QUEUE } from './dpdpa-deletion.service';
import { DpdpaDeletionRepository } from './dpdpa-deletion.repository';
import { DpdpaHardDeleteProcessor } from '../../workers/dpdpa-hard-delete.processor';
import { ConsentService } from './consent.service';
import { ConsentRepository } from './consent.repository';

const OCCASION_REMINDER_CRON = '30 2 * * *';
const DPDPA_SWEEP_CRON       = '30 20 * * *';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    SearchModule,
    BullModule.registerQueue({ name: 'occasion-reminder' }),
    BullModule.registerQueue({ name: DPDPA_HARD_DELETE_QUEUE }),
  ],
  controllers: [CrmController],
  providers: [
    CrmService, CrmRepository,
    CrmSearchService,
    FamilyService, FamilyRepository,
    HistoryService,
    BalanceService,
    NotesService,
    OccasionsService,
    OccasionReminderProcessor,
    DpdpaDeletionService, DpdpaDeletionRepository,
    DpdpaHardDeleteProcessor,
    ConsentService, ConsentRepository,
    CustomerAuthGuard,
    {
      provide: 'KMS_ADAPTER',
      useFactory: () => {
        const secret = process.env['KMS_MASTER_SECRET'];
        const isProduction = process.env['NODE_ENV'] === 'production';
        const hasAzureKv = Boolean(process.env['AZURE_KEY_VAULT_URL']);
        // In production: require Azure Key Vault (preferred) OR an explicit KMS_MASTER_SECRET
        // (demo/GCP deployments before Azure is provisioned — data is encrypted at rest but
        // key material lives in Cloud Run env, not a HSM; acceptable until anchor SOW signs).
        if (isProduction && !hasAzureKv && !secret) {
          throw new Error(
            'Production requires AZURE_KEY_VAULT_URL or KMS_MASTER_SECRET. ' +
            'LocalKMS is ephemeral and must not run in production.',
          );
        }
        return secret ? new DevKmsAdapter(secret) : new LocalKMS();
      },
    },
  ],
  exports: [CrmService, CrmSearchService, FamilyService, HistoryService, NotesService, OccasionsService, DpdpaDeletionService, ConsentService],
})
export class CrmModule implements OnModuleInit {
  private readonly logger = new Logger(CrmModule.name);

  constructor(
    @InjectQueue('occasion-reminder')        private readonly occasionQueue: Queue,
    @InjectQueue(DPDPA_HARD_DELETE_QUEUE)    private readonly dpdpaQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.occasionQueue.upsertJobScheduler(
        'occasion-reminder-daily',
        { pattern: OCCASION_REMINDER_CRON, tz: 'Asia/Kolkata' },
        { name: 'daily-check' },
      );
    } catch (err) {
      this.logger.warn(
        `Occasion reminder job scheduler could not be registered at boot — will retry on next restart: ${String(err)}`,
      );
    }
    try {
      await this.dpdpaQueue.upsertJobScheduler(
        'dpdpa-sweep-daily',
        { pattern: DPDPA_SWEEP_CRON, tz: 'Asia/Kolkata' },
        { name: 'sweep' },
      );
    } catch (err) {
      this.logger.warn(
        `dpdpa sweep job scheduler could not be registered at boot — will retry on next restart: ${String(err)}`,
      );
    }
  }
}
