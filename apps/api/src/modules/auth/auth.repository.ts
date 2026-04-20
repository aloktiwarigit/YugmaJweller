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

  async inviteStaff(args: {
    phone: string;
    role: 'shop_staff' | 'shop_manager';
    displayName: string;
    invitedByUserId: string;
    shopId: string;
    tenant: Tenant;
  }): Promise<{ conflict: boolean; userId?: string }> {
    return withTenantTx(this.pool, async (tx) => {
      const conflict = await tx.query<{ id: string }>(
        `SELECT id FROM shop_users
          WHERE shop_id = $1 AND phone = $2 AND status IN ('INVITED', 'ACTIVE', 'REVOKED')`,
        [args.shopId, args.phone],
      );
      if ((conflict.rowCount ?? 0) > 0) return { conflict: true };

      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status, invited_by_user_id, invited_at)
         VALUES ($1, $2, $3, $4, 'INVITED', $5, now())
         RETURNING id`,
        [args.shopId, args.phone, args.displayName, args.role, args.invitedByUserId],
      );
      return { conflict: false, userId: inserted.rows[0].id };
    });
  }

  async revokeStaff(shopId: string, targetUserId: string): Promise<{ firebaseUid: string | null; role: ShopUserRole; status: string } | null> {
    const c = await this.pool.connect();
    try {
      await c.query('SET ROLE app_user');
      await c.query(`SET app.current_shop_id = '${shopId}'`);
      const res = await c.query<{ firebase_uid: string | null; role: ShopUserRole; status: string }>(
        `SELECT firebase_uid, role, status FROM shop_users WHERE id = $1 AND shop_id = $2 AND status != 'REVOKED'`,
        [targetUserId, shopId],
      );
      if (res.rows.length === 0) return null;
      return { firebaseUid: res.rows[0].firebase_uid, role: res.rows[0].role, status: res.rows[0].status };
    } finally {
      await c.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch(() => undefined);
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  }

  async markRevoked(shopId: string, targetUserId: string, revokedByUserId: string): Promise<void> {
    await withTenantTx(this.pool, async (tx) => {
      await tx.query(
        `UPDATE shop_users
            SET status = 'REVOKED',
                revoked_at = NOW(),
                revoked_by_user_id = $1,
                updated_at = NOW()
          WHERE id = $2 AND shop_id = $3 AND status != 'REVOKED'`,
        [revokedByUserId, targetUserId, shopId],
      );
    });
  }

  async listUsers(shopId: string): Promise<Array<{
    id: string; displayName: string; role: string; status: string;
    phone: string; invitedAt: string | null; activatedAt: string | null;
  }>> {
    const c = await this.pool.connect();
    try {
      await c.query('SET ROLE app_user');
      // Set GUC so RLS policy on shop_users can filter on current_setting('app.current_shop_id').
      await c.query(`SET app.current_shop_id = '${shopId}'`);
      const res = await c.query<{
        id: string; display_name: string; role: string; status: string;
        phone: string; invited_at: string | null; activated_at: string | null;
      }>(
        `SELECT id, display_name, role, status, phone, invited_at, activated_at
           FROM shop_users WHERE shop_id = $1 ORDER BY created_at DESC`,
        [shopId],
      );
      return res.rows.map((r) => ({
        id: r.id,
        displayName: r.display_name,
        role: r.role,
        status: r.status,
        phone: r.phone,
        invitedAt: r.invited_at,
        activatedAt: r.activated_at,
      }));
    } finally {
      await c.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch(() => undefined);
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  }
}
