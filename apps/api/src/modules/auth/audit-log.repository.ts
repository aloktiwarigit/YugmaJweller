import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditLogDateRange = 'today' | '7d' | '30d';
export type AuditLogCategory = 'login' | 'staff' | 'settings' | 'permissions';

export interface AuditLogFilters {
  page: number;
  pageSize: number;
  dateRange?: AuditLogDateRange;
  category?: AuditLogCategory;
}

export interface AuditEventDto {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  createdAt: string; // ISO UTC
  metadata?: Record<string, unknown>;
}

export interface PaginatedAuditLog {
  events: AuditEventDto[];
  total: number;
}

// ---------------------------------------------------------------------------
// Category → action name map
// ---------------------------------------------------------------------------

const CATEGORY_ACTIONS: Record<AuditLogCategory, string[]> = {
  // User-facing login activity — excludes internal infra events (UID mismatch, token invalid, tenant boot)
  login: [
    'AUTH_VERIFY_SUCCESS', 'AUTH_VERIFY_FAILURE', 'AUTH_VERIFY_LOCKED',
    'AUTH_VERIFY_REJECTED', 'AUTH_USER_PROVISIONED', 'AUTH_LOGOUT_ALL',
  ],
  staff: ['STAFF_INVITED', 'STAFF_REVOKED', 'STAFF_ACTIVATED'],
  settings: [
    'SETTINGS_PROFILE_UPDATED', 'SETTINGS_MAKING_CHARGES_UPDATED',
    'SETTINGS_WASTAGE_UPDATED', 'SETTINGS_RATE_LOCK_UPDATED',
    'SETTINGS_LOYALTY_UPDATED', 'SETTINGS_TRY_AT_HOME_UPDATED',
    'SETTINGS_CUSTOM_ORDER_POLICY_UPDATED', 'SETTINGS_RETURN_POLICY_UPDATED',
    'SETTINGS_NOTIFICATION_PREFS_UPDATED',
  ],
  permissions: ['PERMISSIONS_UPDATED', 'ACCESS_DENIED'],
};

// ---------------------------------------------------------------------------
// IST midnight boundary helper
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

function dateFromParam(range?: AuditLogDateRange): Date {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const midnightIST = new Date(
    Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - IST_OFFSET_MS,
  );

  switch (range) {
    case 'today':
      return midnightIST;
    case '7d':
      return new Date(midnightIST.getTime() - 6 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(midnightIST.getTime() - 29 * 24 * 60 * 60 * 1000);
    default:
      return new Date(midnightIST.getTime() - 29 * 24 * 60 * 60 * 1000);
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

@Injectable()
export class AuditLogRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async findPaginated(filters: AuditLogFilters): Promise<PaginatedAuditLog> {
    const pageSize = Math.min(filters.pageSize, 50);
    const offset = (filters.page - 1) * pageSize;
    const dateFrom = dateFromParam(filters.dateRange);
    const actions = filters.category != null ? (CATEGORY_ACTIONS[filters.category] ?? null) : null;

    return withTenantTx(this.pool, async (tx) => {
      const rows = await tx.query(
        `SELECT ae.id, ae.action, ae.created_at, ae.metadata,
                su.display_name AS actor_name,
                su.role AS actor_role
         FROM audit_events ae
         LEFT JOIN shop_users su ON su.id = ae.actor_user_id
         WHERE ae.created_at >= $1
           AND ($2::text[] IS NULL OR ae.action = ANY($2))
         ORDER BY ae.created_at DESC
         LIMIT $3 OFFSET $4`,
        [dateFrom, actions, pageSize, offset],
      );

      const countResult = await tx.query(
        `SELECT COUNT(*)::text AS total
         FROM audit_events ae
         WHERE ae.created_at >= $1
           AND ($2::text[] IS NULL OR ae.action = ANY($2))`,
        [dateFrom, actions],
      );

      const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
      const events: AuditEventDto[] = rows.rows.map((r: {
        id: string;
        action: string;
        created_at: Date;
        metadata: Record<string, unknown> | null;
        actor_name: string | null;
        actor_role: string | null;
      }) => ({
        id: r.id,
        action: r.action,
        actorName: r.actor_name ?? 'System',
        actorRole: r.actor_role ?? 'system',
        createdAt: r.created_at.toISOString(),
        metadata: r.metadata ?? undefined,
      }));

      return { events, total };
    });
  }
}
