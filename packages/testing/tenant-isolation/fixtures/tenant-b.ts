import type { Pool } from 'pg';
import { fixtureRegistry } from './registry';

export const TENANT_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const TENANT_B_PHONE = '+15555550002';
export const TENANT_B_UID   = 'firebase-uid-b';

fixtureRegistry.add({
  id: TENANT_B_ID,
  slug: 'fixture-b',
  displayName: 'Fixture Tenant B',
  seed: async (pool: Pool, id: string) => {
    const c = await pool.connect();
    try {
      await c.query(`SET ROLE app_user`);
      await c.query(`SET app.current_shop_id='${id}'`);
      await c.query(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status, firebase_uid) VALUES
          ($1, $2, 'Bhavna B', 'shop_admin', 'ACTIVE', $3),
          ($1, '+15555550012', 'Bhim B', 'shop_manager', 'ACTIVE', null)`,
        [id, TENANT_B_PHONE, TENANT_B_UID],
      );
      for (let i = 1; i <= 5; i++) {
        await c.query(
          `INSERT INTO audit_events (shop_id, action, subject_type) VALUES ($1, $2, 'seed')`,
          [id, `seed.b.${i}`],
        );
      }
      await c.query(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'CHAIN-B-001', 'SILVER', '999', '5.0000', '4.5000', '0.0000', 'IN_STOCK', $1)`,
        [id],
      );
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  },
});
