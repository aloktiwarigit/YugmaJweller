import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { signImpersonationToken } from '../impersonation-token';

const TTL_SECONDS = 30 * 60;

export interface StartImpersonationArgs {
  platformUserId: string;
  targetShopId: string;
  reason: string;
  ip?: string;
  userAgent?: string;
}

export interface StartImpersonationResult {
  sessionId: string;
  token: string;
  expiresAt: string;
}

async function withPlatformAdmin<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('SET LOCAL ROLE platform_admin');
    return await fn(c);
  } finally {
    await c.query('RESET ROLE').catch(() => undefined);
    c.release();
  }
}

@Injectable()
export class ImpersonationService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async startImpersonation(a: StartImpersonationArgs): Promise<StartImpersonationResult> {
    const secret = process.env['IMPERSONATION_JWT_SECRET'];
    if (!secret) throw new UnauthorizedException({ code: 'impersonation.secret_missing' });

    return withPlatformAdmin(this.pool, async (c) => {
      const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
      const r = await c.query<{ id: string }>(
        `INSERT INTO impersonation_sessions
           (platform_user_id, target_shop_id, expires_at, reason, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5::inet, $6)
         RETURNING id`,
        [a.platformUserId, a.targetShopId, expiresAt, a.reason, a.ip ?? null, a.userAgent ?? null],
      );
      const sessionId = r.rows[0]!.id;
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4::inet, $5, $6::jsonb)`,
        [
          'impersonation.started',
          a.platformUserId,
          a.targetShopId,
          a.ip ?? null,
          a.userAgent ?? null,
          JSON.stringify({ sessionId, reason: a.reason, ttlSeconds: TTL_SECONDS }),
        ],
      );

      const token = signImpersonationToken({
        sessionId,
        platformUserId: a.platformUserId,
        targetShopId: a.targetShopId,
        ttlSeconds: TTL_SECONDS,
        secret,
      });
      return { sessionId, token, expiresAt: expiresAt.toISOString() };
    });
  }

  async endImpersonation(sessionId: string, platformUserId: string): Promise<void> {
    await withPlatformAdmin(this.pool, async (c) => {
      const upd = await c.query(
        `UPDATE impersonation_sessions
            SET ended_at = now()
          WHERE id = $1 AND platform_user_id = $2 AND ended_at IS NULL`,
        [sessionId, platformUserId],
      );
      if (upd.rowCount === 0) {
        throw new NotFoundException({ code: 'impersonation_session.not_found' });
      }
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, metadata)
         VALUES ($1, $2, $3::jsonb)`,
        ['impersonation.ended', platformUserId, JSON.stringify({ sessionId })],
      );
    });
  }
}
