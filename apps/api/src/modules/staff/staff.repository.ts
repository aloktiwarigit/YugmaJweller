import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import type { InviteRole } from './dto/invite-staff.dto';
import type { StaffListItemDto } from './dto/staff-list-item.dto';

export interface ShopUserRow {
  id: string;
  phone: string;
  display_name: string;
  role: 'shop_admin' | 'shop_manager' | 'shop_staff';
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  invited_by_user_id: string | null;
  invited_at: string;
  activated_at: string | null;
}

@Injectable()
export class StaffRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async findByPhone(phone: string): Promise<Pick<ShopUserRow, 'id' | 'status'> | null> {
    return withTenantTx(this.pool, async (tx) => {
      const res = await tx.query<{ id: string; status: ShopUserRow['status'] }>(
        `SELECT id, status FROM shop_users WHERE phone = $1`,
        [phone],
      );
      return res.rows[0] ?? null;
    });
  }

  async insertInvited(args: {
    phone: string;
    displayName: string;
    role: InviteRole;
    invitedByUserId: string;
  }): Promise<ShopUserRow> {
    return withTenantTx(this.pool, async (tx) => {
      const existing = await tx.query<{ id: string; status: ShopUserRow['status'] }>(
        `SELECT id, status FROM shop_users WHERE phone = $1`,
        [args.phone],
      );

      if (existing.rows.length > 0) {
        const { status } = existing.rows[0]!;
        if (status !== 'INVITED') {
          throw new ConflictException('staff.already_exists');
        }
        return this.refreshInvited({ existingId: existing.rows[0]!.id, invitedByUserId: args.invitedByUserId });
      }

      const res = await tx.query<ShopUserRow>(
        `INSERT INTO shop_users (id, shop_id, phone, display_name, role, status, invited_by_user_id, invited_at, created_at, updated_at)
         VALUES (gen_random_uuid(), current_setting('app.current_shop_id')::uuid, $1, $2, $3, 'INVITED', $4, now(), now(), now())
         RETURNING id, phone, display_name, role, status, invited_by_user_id, invited_at, activated_at`,
        [args.phone, args.displayName, args.role, args.invitedByUserId],
      );
      return res.rows[0]!;
    });
  }

  async refreshInvited(args: { existingId: string; invitedByUserId: string }): Promise<ShopUserRow> {
    return withTenantTx(this.pool, async (tx) => {
      const res = await tx.query<ShopUserRow>(
        `UPDATE shop_users
            SET invited_by_user_id = $2,
                invited_at         = now(),
                updated_at         = now()
          WHERE id = $1
            AND status = 'INVITED'
          RETURNING id, phone, display_name, role, status, invited_by_user_id, invited_at, activated_at`,
        [args.existingId, args.invitedByUserId],
      );
      return res.rows[0]!;
    });
  }

  async findAllByShop(): Promise<StaffListItemDto[]> {
    return withTenantTx(this.pool, async (tx) => {
      const res = await tx.query<{
        id: string;
        display_name: string;
        phone: string;
        role: ShopUserRow['role'];
        status: ShopUserRow['status'];
        invited_at: string | null;
        activated_at: string | null;
      }>(
        `SELECT id, display_name, phone, role, status, invited_at, activated_at
           FROM shop_users
          ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'INVITED' THEN 1 ELSE 2 END, created_at`,
      );
      return res.rows.map((r) => ({
        id: r.id,
        display_name: r.display_name,
        phone_last4: r.phone.slice(-4),
        role: r.role,
        status: r.status,
        invited_at: r.invited_at,
        activated_at: r.activated_at,
      }));
    });
  }
}
