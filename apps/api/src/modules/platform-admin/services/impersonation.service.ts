import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Pool } from 'pg';
import { signImpersonationToken } from '../impersonation-token';
import { platformGlobalTx } from '../../../platform-global-execute';
import { PG_POOL_ADMIN } from '../platform-admin.tokens';

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

// Pool here is PG_POOL_ADMIN, which connects directly as platform_admin.
// BEGIN/COMMIT remains for atomicity — session row + audit event must succeed or fail together.
@Injectable()
export class ImpersonationService {
  constructor(@Inject(PG_POOL_ADMIN) private readonly pool: Pool) {}

  async startImpersonation(a: StartImpersonationArgs): Promise<StartImpersonationResult> {
    const secret = process.env['IMPERSONATION_JWT_SECRET'];
    if (!secret) throw new UnauthorizedException({ code: 'impersonation.secret_missing' });
    if (secret.length < 32) {
      // HS256 keysize floor — runbook §16 requires `openssl rand -base64 48`. Refuse to mint
      // tokens with a weak HMAC key rather than emit signatures the strategy will later reject.
      throw new UnauthorizedException({ code: 'impersonation.secret_invalid' });
    }

    return platformGlobalTx(this.pool, 'platform-admin impersonation start with audit', async (c) => {
      // Pre-flight: target shop must exist AND be ACTIVE. TenantInterceptor enforces the
      // same status check on every impersonated request, so without this guard we'd happily
      // mint a JWT that the very next API call would reject as `tenant.inactive`. Worse,
      // the audit row is written before the impersonator discovers the session is unusable.
      const status = await c.query<{ status: string }>(
        `SELECT status FROM shops WHERE id = $1`,
        [a.targetShopId],
      );
      if (status.rows.length === 0) {
        throw new NotFoundException({ code: 'impersonation.target_shop_not_found' });
      }
      if (status.rows[0]!.status !== 'ACTIVE') {
        throw new NotFoundException({ code: 'impersonation.target_shop_not_active' });
      }

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
    await platformGlobalTx(this.pool, 'platform-admin impersonation end with audit', async (c) => {
      const upd = await c.query<{ target_shop_id: string }>(
        `UPDATE impersonation_sessions
            SET ended_at = now()
          WHERE id = $1 AND platform_user_id = $2 AND ended_at IS NULL
          RETURNING target_shop_id`,
        [sessionId, platformUserId],
      );
      if (upd.rowCount === 0) {
        throw new NotFoundException({ code: 'impersonation_session.not_found' });
      }
      // Include target_shop_id so tenant-scoped audit queries pair this `impersonation.ended`
      // event with the matching `impersonation.started` row.
      const targetShopId = upd.rows[0]!.target_shop_id;
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        ['impersonation.ended', platformUserId, targetShopId, JSON.stringify({ sessionId })],
      );
    });
  }
}
