import {
  Module,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from '@goldsmith/queue';
import { LocalKMS, DevKmsAdapter } from '@goldsmith/crypto-envelope';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CrmRepository } from './crm.repository';
import { FamilyService } from './family.service';
import { FamilyRepository } from './family.repository';
import { HistoryService } from './history.service';
import { BalanceService } from './balance.service';
import { NotesService } from './notes.service';
import { OccasionsService } from './occasions.service';
import { OccasionReminderProcessor } from '../../workers/occasion-reminder.processor';

// Daily reminder check at 08:00 IST (UTC+5:30 = 02:30 UTC)
const OCCASION_REMINDER_CRON = '30 2 * * *';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    BullModule.registerQueue({ name: 'occasion-reminder' }),
  ],
  controllers: [CrmController],
  providers: [
    CrmService, CrmRepository,
    FamilyService, FamilyRepository,
    HistoryService,
    BalanceService,
    NotesService,
    OccasionsService,
    OccasionReminderProcessor,
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
  exports: [CrmService, FamilyService, NotesService, OccasionsService],
})
export class CrmModule implements OnModuleInit {
  private readonly logger = new Logger(CrmModule.name);

  constructor(
    @InjectQueue('occasion-reminder') private readonly occasionQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Register repeatable daily-check job — best-effort: Redis may be transiently unavailable at boot
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
  }
}
