import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DrizzleTenantLookup } from '../../../drizzle-tenant-lookup';
import { PG_POOL_ADMIN } from '../platform-admin.module';

export interface CreateShopArgs {
  slug: string;
  displayName: string;
  platformUserId: string;
}

export interface UpdateShopArgs {
  shopId: string;
  platformUserId: string;
  patch: Partial<{
    displayName: string;
    contactPhone: string;
    aboutText: string;
  }>;
}

export interface ListShopsArgs {
  page: number;
  pageSize: number;
  search?: string;
}

export interface ShopRow {
  id: string;
  slug: string;
  display_name: string;
  status: string;
  created_at: string;
}

export interface ListShopsResult {
  items: ShopRow[];
  total: number;
}

// Pool here is PG_POOL_ADMIN, which connects directly as platform_admin role.
// BEGIN/COMMIT remains for atomicity — write + audit inserts must succeed or fail together.
async function inTx<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    try {
      const result = await fn(c);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    }
  } finally {
    c.release();
  }
}

@Injectable()
export class TenantManagementService {
  constructor(
    @Inject(PG_POOL_ADMIN) private readonly pool: Pool,
    @Inject(DrizzleTenantLookup) private readonly cache: DrizzleTenantLookup,
  ) {}

  async createShop(a: CreateShopArgs): Promise<{ id: string }> {
    return inTx(this.pool, async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO shops (slug, display_name, status) VALUES ($1, $2, 'PROVISIONING') RETURNING id`,
        [a.slug, a.displayName],
      );
      const id = r.rows[0]!.id;
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        ['tenant.created', a.platformUserId, id, JSON.stringify({ slug: a.slug, displayName: a.displayName })],
      );
      return { id };
    });
  }

  async updateShop(a: UpdateShopArgs): Promise<void> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (a.patch.displayName !== undefined) { fields.push(`display_name = $${i++}`); params.push(a.patch.displayName); }
    if (a.patch.contactPhone !== undefined) { fields.push(`contact_phone = $${i++}`); params.push(a.patch.contactPhone); }
    if (a.patch.aboutText !== undefined) { fields.push(`about_text = $${i++}`); params.push(a.patch.aboutText); }
    if (fields.length === 0) return;
    fields.push(`updated_at = now()`);
    params.push(a.shopId);
    await inTx(this.pool, async (c) => {
      const r = await c.query(`UPDATE shops SET ${fields.join(', ')} WHERE id = $${i}`, params);
      if (r.rowCount === 0) throw new NotFoundException({ code: 'tenant.not_found' });
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        ['tenant.updated', a.platformUserId, a.shopId, JSON.stringify(a.patch)],
      );
      this.cache.invalidate(a.shopId);
    });
  }

  async suspendShop(shopId: string, reason: string, platformUserId: string): Promise<void> {
    await inTx(this.pool, async (c) => {
      const r = await c.query(
        `UPDATE shops SET status = 'SUSPENDED', updated_at = now() WHERE id = $1 AND status <> 'TERMINATED'`,
        [shopId],
      );
      if (r.rowCount === 0) throw new NotFoundException({ code: 'tenant.not_found' });
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        ['tenant.suspended', platformUserId, shopId, JSON.stringify({ reason })],
      );
      this.cache.invalidate(shopId);
    });
  }

  async unsuspendShop(shopId: string, platformUserId: string): Promise<void> {
    await inTx(this.pool, async (c) => {
      const r = await c.query(
        `UPDATE shops SET status = 'ACTIVE', updated_at = now() WHERE id = $1 AND status = 'SUSPENDED'`,
        [shopId],
      );
      if (r.rowCount === 0) throw new NotFoundException({ code: 'tenant.not_found' });
      await c.query(
        `INSERT INTO platform_audit_events (action, platform_user_id, target_shop_id, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        ['tenant.unsuspended', platformUserId, shopId, '{}'],
      );
      this.cache.invalidate(shopId);
    });
  }

  async listShops(a: ListShopsArgs): Promise<ListShopsResult> {
    const offset = Math.max(0, (a.page - 1) * a.pageSize);
    return inTx(this.pool, async (c) => {
      const items = await c.query<ShopRow>(
        a.search
          ? `SELECT id, slug, display_name, status, created_at FROM shops
               WHERE slug ILIKE $3 OR display_name ILIKE $3
               ORDER BY created_at DESC LIMIT $1 OFFSET $2`
          : `SELECT id, slug, display_name, status, created_at FROM shops
               ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        a.search ? [a.pageSize, offset, `%${a.search}%`] : [a.pageSize, offset],
      );
      const cnt = await c.query<{ count: string }>(
        a.search
          ? `SELECT COUNT(*)::text AS count FROM shops WHERE slug ILIKE $1 OR display_name ILIKE $1`
          : `SELECT COUNT(*)::text AS count FROM shops`,
        a.search ? [`%${a.search}%`] : [],
      );
      return { items: items.rows, total: Number(cnt.rows[0]!.count) };
    });
  }
}
