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
      // is platform-only (no app_user grants), and (b) we read a single row by id and return only a boolean.
      await c.query('SET LOCAL ROLE platform_admin');
      const r = await c.query<{ active: boolean }>(
        `SELECT (ended_at IS NULL AND expires_at > now()) AS active
           FROM impersonation_sessions WHERE id = $1`,
        [sessionId],
      );
      return r.rows[0]?.active === true;
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  }
}
