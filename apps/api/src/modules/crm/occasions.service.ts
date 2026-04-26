import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { auditLog, AuditAction } from '@goldsmith/audit';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';

export interface OccasionRow {
  id: string;
  shop_id: string;
  customer_id: string;
  occasion_type: string;
  label: string | null;
  month_day: string;
  next_occurrence: string | null;
  reminder_days: number;
  created_at: Date;
}

export interface AddOccasionDto {
  occasionType: 'BIRTHDAY' | 'ANNIVERSARY' | 'FESTIVAL' | 'OTHER';
  label?: string;
  monthDay: string; // 'MM-DD'
  reminderDays?: number;
}

export interface OccasionResponse {
  id: string;
  customerId: string;
  occasionType: string;
  label: string | null;
  monthDay: string;
  nextOccurrence: string | null;
  reminderDays: number;
  createdAt: string;
}

/**
 * Given 'MM-DD', compute next occurrence date in IST.
 * - If this year's date >= today (IST): return this year
 * - Else: return next year
 * - Feb 29 on non-leap year: use Mar 1
 */
export function computeNextOccurrence(monthDay: string): string {
  const [mm, dd] = monthDay.split('-').map(Number);

  // Get today in IST
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const todayYear = nowIST.getFullYear();
  const todayMonth = nowIST.getMonth() + 1; // 1-indexed
  const todayDay = nowIST.getDate();

  function isLeapYear(y: number): boolean {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  function resolveDate(
    year: number,
    month: number,
    day: number,
  ): { year: number; month: number; day: number } {
    // Feb 29 on non-leap year → Mar 1
    if (month === 2 && day === 29 && !isLeapYear(year)) {
      return { year, month: 3, day: 1 };
    }
    return { year, month, day };
  }

  function pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  // Try this year first
  const thisYear = resolveDate(todayYear, mm, dd);
  const thisYearDate = `${thisYear.year}-${pad(thisYear.month)}-${pad(thisYear.day)}`;

  // Compare: is this year's occurrence >= today?
  const todayStr = `${todayYear}-${pad(todayMonth)}-${pad(todayDay)}`;
  if (thisYearDate >= todayStr) {
    return thisYearDate;
  }

  // Use next year
  const nextYear = resolveDate(todayYear + 1, mm, dd);
  return `${nextYear.year}-${pad(nextYear.month)}-${pad(nextYear.day)}`;
}

function rowToResponse(row: OccasionRow): OccasionResponse {
  return {
    id: row.id,
    customerId: row.customer_id,
    occasionType: row.occasion_type,
    label: row.label,
    monthDay: row.month_day,
    nextOccurrence: row.next_occurrence,
    reminderDays: row.reminder_days,
    createdAt: row.created_at.toISOString(),
  };
}

@Injectable()
export class OccasionsService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async addOccasion(
    ctx: AuthenticatedTenantContext,
    customerId: string,
    dto: AddOccasionDto,
  ): Promise<OccasionResponse> {
    const nextOccurrence = computeNextOccurrence(dto.monthDay);
    const occ = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<OccasionRow>(
        `INSERT INTO customer_occasions (shop_id, customer_id, occasion_type, label, month_day, next_occurrence, reminder_days)
         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          customerId,
          dto.occasionType,
          dto.label ?? null,
          dto.monthDay,
          nextOccurrence,
          dto.reminderDays ?? 7,
        ],
      );
      return r.rows[0];
    });

    void auditLog(this.pool, {
      action: AuditAction.CRM_OCCASION_ADDED,
      subjectType: 'customer_occasion',
      subjectId: occ.id,
      actorUserId: ctx.userId,
      after: { customerId, occasionId: occ.id },
    }).catch(() => undefined);

    return rowToResponse(occ);
  }

  async listOccasions(
    _ctx: AuthenticatedTenantContext,
    customerId: string,
  ): Promise<OccasionResponse[]> {
    const rows = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<OccasionRow>(
        `SELECT * FROM customer_occasions WHERE customer_id = $1 ORDER BY next_occurrence ASC NULLS LAST`,
        [customerId],
      );
      return r.rows;
    });
    return rows.map(rowToResponse);
  }

  async deleteOccasion(_ctx: AuthenticatedTenantContext, occasionId: string): Promise<void> {
    await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<OccasionRow>(
        `DELETE FROM customer_occasions WHERE id = $1 RETURNING *`,
        [occasionId],
      );
      if (!r.rows[0]) throw new NotFoundException({ code: 'crm.occasion_not_found' });
    });
  }
}
