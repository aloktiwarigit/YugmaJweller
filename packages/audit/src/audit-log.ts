import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';

export interface AuditEntry {
  action: string;
  subjectType: string;
  subjectId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  actorUserId?: string;
  ip?: string;
  userAgent?: string;
}

export async function auditLog(pool: Pool, entry: AuditEntry): Promise<void> {
  await withTenantTx(pool, async (tx) => {
    await tx.query(
      `INSERT INTO audit_events
       (shop_id, actor_user_id, action, subject_type, subject_id, before, after, metadata, ip, user_agent)
       VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.actorUserId ?? null,
        entry.action,
        entry.subjectType,
        entry.subjectId ?? null,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after ? JSON.stringify(entry.after) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.ip ?? null,
        entry.userAgent ?? null,
      ],
    );
  });
}
