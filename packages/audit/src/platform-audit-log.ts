import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { AuditAction } from './audit-actions';

export interface PlatformAuditEntry {
  action: AuditAction;
  phoneE164?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

const PHONE_KEYS = /^(phone|phone_number|phoneE164|phone_e164)$/i;

function scrubMetadata(m: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!m) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    if (PHONE_KEYS.test(k)) throw new Error('platform-audit-log.phone_in_metadata_forbidden — use phoneE164 param');
    out[k] = v;
  }
  return out;
}

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

export async function platformAuditLog(pool: Pool, entry: PlatformAuditEntry): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO platform_audit_events
        (action, ip_address, user_agent, request_id, phone_hash, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.action,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
        entry.requestId ?? null,
        entry.phoneE164 ? sha256(entry.phoneE164) : null,
        JSON.stringify(scrubMetadata(entry.metadata)),
      ],
    );
  } finally { c.release(); }
}
