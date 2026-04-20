import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx, POISON_UUID } from '@goldsmith/db';
import { tenantContext } from '@goldsmith/tenant-context';
import type { ShopUserRole } from '@goldsmith/tenant-context';

@Injectable()
export class PermissionsRepository {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async getPermissions(shopId: string, role: ShopUserRole): Promise<Record<string, boolean>> {
    const c = await this.pool.connect();
    try {
      await c.query('SET ROLE app_user');
      const res = await c.query<{ permission_key: string; is_enabled: boolean }>(
        `SELECT permission_key, is_enabled FROM role_permissions WHERE shop_id = $1 AND role = $2`,
        [shopId, role],
      );
      return Object.fromEntries(res.rows.map((r) => [r.permission_key, r.is_enabled]));
    } finally {
      await c.query(`SET app.current_shop_id = '${POISON_UUID}'`).catch(() => undefined);
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  }

  async upsertPermission(shopId: string, role: ShopUserRole, key: string, enabled: boolean): Promise<void> {
    return tenantContext.runWith(
      { shopId, tenant: { id: shopId, slug: '', display_name: '', status: 'ACTIVE' }, authenticated: false },
      () =>
        withTenantTx(this.pool, async (tx) => {
          await tx.query(
            `INSERT INTO role_permissions (shop_id, role, permission_key, is_enabled)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (shop_id, role, permission_key)
             DO UPDATE SET is_enabled = $4, updated_at = now()`,
            [shopId, role, key, enabled],
          );
        }),
    );
  }

  async seedDefaults(shopId: string): Promise<void> {
    const managerDefaults: Array<[string, boolean]> = [
      ['billing.create', true],  ['billing.void', false], ['inventory.edit', false],
      ['settings.edit',  false], ['reports.view', true],  ['analytics.view',  true],
    ];
    const staffDefaults: Array<[string, boolean]> = [
      ['billing.create', true],  ['billing.void', false], ['inventory.edit', false],
      ['settings.edit',  false], ['reports.view', false], ['analytics.view', false],
    ];
    const c = await this.pool.connect();
    try {
      for (const [key, val] of managerDefaults) {
        await c.query(
          `INSERT INTO role_permissions (shop_id, role, permission_key, is_enabled)
           VALUES ($1, 'shop_manager', $2, $3) ON CONFLICT DO NOTHING`,
          [shopId, key, val],
        );
      }
      for (const [key, val] of staffDefaults) {
        await c.query(
          `INSERT INTO role_permissions (shop_id, role, permission_key, is_enabled)
           VALUES ($1, 'shop_staff', $2, $3) ON CONFLICT DO NOTHING`,
          [shopId, key, val],
        );
      }
    } finally {
      c.release();
    }
  }
}
