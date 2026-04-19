import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx, POISON_UUID } from '@goldsmith/db';
import { tenantContext, type Tenant, type ShopUserRole, type UnauthenticatedTenantContext } from '@goldsmith/tenant-context';

export interface PhoneLookupRow {
  shopId: string;
  userId: string;
  role: ShopUserRole;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  firebaseUid: string | null;
}

@Injectable()
export class AuthRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async lookupByPhone(phoneE164: string): Promise<PhoneLookupRow | null> {
    const c = await this.pool.connect();
    try {
      await c.query('SET ROLE app_user');
      const res = await c.query<{
        shop_id: string; user_id: string; role: ShopUserRole;
        status: PhoneLookupRow['status']; firebase_uid: string | null;
      }>(`SELECT * FROM auth_lookup_user_by_phone($1)`, [phoneE164]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return { shopId: r.shop_id, userId: r.user_id, role: r.role, status: r.status, firebaseUid: r.firebase_uid };
    } finally {
      // Re-poison the GUC so no subsequent pool connection sees a stale shop context.
      await c.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch(() => undefined);
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  }

  /**
   * Atomically link a Firebase UID to a shop_user row.
   * The WHERE clause only matches when firebase_uid IS NULL or already equals $incoming,
   * preventing a TOCTOU race where two concurrent /session calls with different UIDs both
   * pass the in-memory guard and race to write.
   *
   * Returns { linked: true } when the UPDATE succeeds, { linked: false } when a concurrent
   * writer won the race (0 rows returned — caller should treat as auth.uid_mismatch).
   */
  async linkFirebaseUid(args: { shopId: string; userId: string; firebaseUid: string; tenant: Tenant }): Promise<{ linked: boolean }> {
    const unauthCtx: UnauthenticatedTenantContext = { shopId: args.shopId, tenant: args.tenant, authenticated: false };
    return tenantContext.runWith(unauthCtx, () =>
      withTenantTx(this.pool, async (tx) => {
        const res = await tx.query<{ firebase_uid: string }>(
          `UPDATE shop_users
              SET firebase_uid = $1,
                  status       = 'ACTIVE',
                  activated_at = COALESCE(activated_at, now()),
                  updated_at   = now()
            WHERE id = $2
              AND shop_id = $3
              AND (firebase_uid IS NULL OR firebase_uid = $1)
            RETURNING firebase_uid`,
          [args.firebaseUid, args.userId, args.shopId],
        );
        return { linked: res.rowCount !== null && res.rowCount > 0 };
      }),
    );
  }
}
