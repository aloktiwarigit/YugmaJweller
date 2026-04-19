import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';
import { platformAuditLog, AuditAction } from '../src';

describe('platformAuditLog', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  const PHONE = '+919000007777';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../db/src/migrations'));
  }, 120_000);
  afterAll(async () => { await pool?.end(); await container?.stop(); });
  beforeEach(async () => { await pool.query('DELETE FROM platform_audit_events'); });

  it('writes row to platform_audit_events without needing tenant ctx', async () => {
    await platformAuditLog(pool, {
      action: AuditAction.AUTH_VERIFY_FAILURE,
      phoneE164: PHONE, ipAddress: '10.0.0.1', userAgent: 'test', requestId: 'req-1',
    });
    const r = await pool.query('SELECT action, phone_hash, ip_address FROM platform_audit_events');
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].action).toBe('AUTH_VERIFY_FAILURE');
    expect(r.rows[0].phone_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('phone_hash is SHA-256(phone_e164), not raw phone', async () => {
    const { createHash } = await import('node:crypto');
    const expected = createHash('sha256').update(PHONE).digest('hex');
    await platformAuditLog(pool, { action: AuditAction.AUTH_VERIFY_SUCCESS, phoneE164: PHONE });
    const r = await pool.query('SELECT phone_hash FROM platform_audit_events LIMIT 1');
    expect(r.rows[0].phone_hash).toBe(expected);
    // Sanity: raw phone must NEVER appear in phone_hash
    expect(r.rows[0].phone_hash).not.toBe(PHONE);
  });

  it('rejects raw phone key in metadata at runtime (defense-in-depth against Semgrep bypass)', async () => {
    await expect(platformAuditLog(pool, {
      action: AuditAction.AUTH_VERIFY_FAILURE,
      metadata: { phone: PHONE },
    })).rejects.toThrow('platform-audit-log.phone_in_metadata_forbidden');
    // also phone_number, phoneE164, phone_e164
    await expect(platformAuditLog(pool, {
      action: AuditAction.AUTH_VERIFY_FAILURE,
      metadata: { phone_number: PHONE },
    })).rejects.toThrow('platform-audit-log.phone_in_metadata_forbidden');
  });

  it('rejects nested phone key in metadata at any depth', async () => {
    await expect(platformAuditLog(pool, {
      action: AuditAction.AUTH_VERIFY_FAILURE,
      metadata: { user: { phone_number: '+919000007777' } },
    })).rejects.toThrow('platform-audit-log.phone_in_metadata_forbidden');
  });

  it('no metadata defaults to empty object', async () => {
    await platformAuditLog(pool, { action: AuditAction.TENANT_BOOT });
    const r = await pool.query('SELECT metadata FROM platform_audit_events LIMIT 1');
    expect(r.rows[0].metadata).toEqual({});
  });
});
