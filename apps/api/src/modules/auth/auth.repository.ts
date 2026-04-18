import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
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
  constructor(private readonly pool: Pool) {}

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
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  }

  async linkFirebaseUid(args: { shopId: string; userId: string; firebaseUid: string; tenant: Tenant }): Promise<void> {
    const unauthCtx: UnauthenticatedTenantContext = { shopId: args.shopId, tenant: args.tenant, authenticated: false };
    await tenantContext.runWith(unauthCtx, () =>
      withTenantTx(this.pool, async (tx) => {
        await tx.query(
          `UPDATE shop_users
              SET firebase_uid = $1,
                  status       = 'ACTIVE',
                  activated_at = now(),
                  updated_at   = now()
            WHERE id = $2 AND shop_id = $3`,
          [args.firebaseUid, args.userId, args.shopId],
        );
      }),
    );
  }
}
