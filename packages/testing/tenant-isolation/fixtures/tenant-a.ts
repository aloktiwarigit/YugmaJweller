import type { Pool } from 'pg';
import { fixtureRegistry } from './registry';

export const TENANT_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const TENANT_A_PHONE = '+15555550001';
export const TENANT_A_UID   = 'firebase-uid-a';

fixtureRegistry.add({
  id: TENANT_A_ID,
  slug: 'fixture-a',
  displayName: 'Fixture Tenant A',
  seed: async (pool: Pool, id: string) => {
    const c = await pool.connect();
    try {
      await c.query(`SET ROLE app_user`);
      await c.query(`SET app.current_shop_id='${id}'`);
      await c.query(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status, firebase_uid) VALUES
          ($1, $2, 'Alice A', 'shop_admin', 'ACTIVE', $3),
          ($1, '+15555550011', 'Akhil A', 'shop_staff', 'ACTIVE', null)`,
        [id, TENANT_A_PHONE, TENANT_A_UID],
      );
      for (let i = 1; i <= 5; i++) {
        await c.query(
          `INSERT INTO audit_events (shop_id, action, subject_type) VALUES ($1, $2, 'seed')`,
          [id, `seed.a.${i}`],
        );
      }
      await c.query(
        `INSERT INTO products
           (shop_id, sku, metal, purity, gross_weight_g, net_weight_g, stone_weight_g, status, created_by_user_id)
         VALUES ($1, 'RING-A-001', 'GOLD', '22K', '10.0000', '9.0000', '0.0000', 'IN_STOCK', $1)`,
        [id],
      );
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  },
});
