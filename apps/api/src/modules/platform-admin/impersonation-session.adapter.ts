import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import type { ImpersonationSessionPort } from '@goldsmith/tenant-context';
import { platformGlobalExecute } from '../../platform-global-execute';
import { PG_POOL_ADMIN } from './platform-admin.tokens';

@Injectable()
export class ImpersonationSessionAdapter implements ImpersonationSessionPort {
  // PLATFORM_ADMIN_BYPASS: intentional cross-tenant read. Safe because (a) impersonation_sessions
  // is platform-only (no app_user grants per migration 0055), (b) we read a single row by id and
  // return only a boolean, and (c) the pool connects directly as platform_admin (which holds
  // the GRANT on impersonation_sessions).
  constructor(@Inject(PG_POOL_ADMIN) private readonly pool: Pool) {}

  async isActive(sessionId: string): Promise<boolean> {
    const r = await platformGlobalExecute(
      'platform impersonation session single-row active check',
      async () => this.pool.query<{ active: boolean }>(
        `SELECT (ended_at IS NULL AND expires_at > now()) AS active
           FROM impersonation_sessions WHERE id = $1`,
        [sessionId],
      ),
    );
    return r.rows[0]?.active === true;
  }
}
