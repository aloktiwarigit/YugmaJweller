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

    // Find occasions due today OR in reminder_days days
    // Use a raw pool connection (no tenant context — this is a platform-level scan)
    const client = await this.pool.connect(); // nosemgrep: goldsmith.require-tenant-transaction — platform worker, cross-tenant scan
    try {
      const r = await client.query<OccasionReminderRow>(
        `SELECT * FROM customer_occasions
         WHERE next_occurrence = $1::date
            OR next_occurrence = ($1::date + reminder_days * INTERVAL '1 day')`,
        [todayIST],
      );

      for (const occ of r.rows) {
        // Emit event for Epic 13 (WhatsApp/push notification)
        this.logger.log(
          `crm.occasion_reminder: shopId=${occ.shop_id} customerId=${occ.customer_id} type=${occ.occasion_type} next=${occ.next_occurrence}`,
        );

        // Advance next_occurrence to next year
        const [year, month, day] = occ.next_occurrence.split('-').map(Number);
        const nextYear = year + 1;
        const isLeap = (y: number): boolean =>
          (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        let newMonth = month;
        let newDay = day;
        if (month === 2 && day === 29 && !isLeap(nextYear)) {
          newMonth = 3;
          newDay = 1;
        }
        const newDate = `${nextYear}-${pad(newMonth)}-${pad(newDay)}`;

        await client.query(
          `UPDATE customer_occasions SET next_occurrence = $1::date WHERE id = $2`,
          [newDate, occ.id],
        );
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
