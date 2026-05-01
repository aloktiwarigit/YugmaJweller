import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import type { ImpersonationSessionPort } from '@goldsmith/tenant-context';

@Injectable()
export class ImpersonationSessionAdapter implements ImpersonationSessionPort {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async isActive(sessionId: string): Promise<boolean> {
    const c = await this.pool.connect();
    try {
      // PLATFORM_ADMIN_BYPASS: intentional cross-tenant read; safe because (a) impersonation_sessions
      // is platform-only (no app_user grants per migration 0055), and (b) we read a single row by id
      // and return only a boolean.
      // SET LOCAL ROLE is transaction-scoped; BEGIN/COMMIT keeps platform_admin role active for
      // the SELECT — without the transaction wrap, the SELECT runs as app_user and fails the grant
      // check on impersonation_sessions, silently returning false for every impersonated request.
      await c.query('BEGIN');
      try {
        await c.query('SET LOCAL ROLE platform_admin');
        const r = await c.query<{ active: boolean }>(
          `SELECT (ended_at IS NULL AND expires_at > now()) AS active
             FROM impersonation_sessions WHERE id = $1`,
          [sessionId],
        );
        await c.query('COMMIT');
        return r.rows[0]?.active === true;
      } catch (e) {
        await c.query('ROLLBACK').catch(() => undefined);
        throw e;
      }
    } finally {
      c.release();
    }
  }
}
