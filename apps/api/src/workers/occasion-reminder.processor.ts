import { Logger, Inject } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from '@goldsmith/queue';
import type { Pool } from 'pg';

interface OccasionReminderRow {
  id: string;
  shop_id: string;
  customer_id: string;
  occasion_type: string;
  label: string | null;
  month_day: string;
  next_occurrence: string;
  reminder_days: number;
}

@Processor('occasion-reminder')
export class OccasionReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(OccasionReminderProcessor.name);

  constructor(@Inject('PG_POOL') private readonly pool: Pool) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'daily-check') return;

    // Get today in IST (Asia/Kolkata)
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const pad = (n: number): string => String(n).padStart(2, '0');
    const todayIST = `${nowIST.getFullYear()}-${pad(nowIST.getMonth() + 1)}-${pad(nowIST.getDate())}`;

    this.logger.log(`occasion-reminder daily-check for IST date=${todayIST}`);

    // Cross-tenant scan via SECURITY DEFINER fns (migration 0035).
    // Raw app_user SELECT would silently return zero rows: provider.ts seeds
    // app.current_shop_id with a poison UUID on every new pool client, and
    // customer_occasions is FORCE RLS. The fns run as platform_admin (BYPASSRLS).
    const client = await this.pool.connect(); // nosemgrep: goldsmith.require-tenant-transaction — platform worker, cross-tenant scan via SECURITY DEFINER fns
    try {
      const r = await client.query<OccasionReminderRow>(
        `SELECT * FROM get_due_occasions($1::date)`,
        [todayIST],
      );

      for (const occ of r.rows) {
        // Emit event for Epic 13 (WhatsApp/push notification)
        this.logger.log(
          `crm.occasion_reminder: shopId=${occ.shop_id} customerId=${occ.customer_id} type=${occ.occasion_type} next=${occ.next_occurrence}`,
        );

        // Advance to next year via SECURITY DEFINER fn (Feb 29 → Mar 1 fallback inside).
        await client.query(`SELECT advance_occasion_to_next_year($1::uuid)`, [occ.id]);
      }

      this.logger.log(`occasion-reminder: processed ${r.rows.length} occasions`);
    } finally {
      client.release();
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `occasion-reminder job failed: jobId=${job?.id ?? 'unknown'} error=${error.message}`,
      error.stack,
    );
  }
}
