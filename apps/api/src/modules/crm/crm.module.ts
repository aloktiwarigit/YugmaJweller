import {
  Module,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from '@goldsmith/queue';
import { LocalKMS, DevKmsAdapter } from '@goldsmith/crypto-envelope';
import { SearchModule } from '@goldsmith/integrations-search';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
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
  exports: [CrmService, CrmSearchService, FamilyService, NotesService, OccasionsService, DpdpaDeletionService, ConsentService],
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
