import type { Pool } from 'pg';
import { fixtureRegistry } from './registry';

export const TENANT_C_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
export const TENANT_C_PHONE = '+15555550003';
export const TENANT_C_UID   = 'firebase-uid-c';

fixtureRegistry.add({
  id: TENANT_C_ID,
  slug: 'fixture-c',
  displayName: 'Fixture Tenant C',
  seed: async (pool: Pool, id: string) => {
    const c = await pool.connect();
    try {
      await c.query(`SET ROLE app_user`);
      await c.query(`SET app.current_shop_id='${id}'`);
      await c.query(
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status, firebase_uid) VALUES
          ($1, $2, 'Chandra C', 'shop_admin', 'ACTIVE', $3),
          ($1, '+15555550013', 'Charu C', 'shop_staff', 'ACTIVE', null)`,
        [id, TENANT_C_PHONE, TENANT_C_UID],
      );
      for (let i = 1; i <= 5; i++) {
        await c.query(
          `INSERT INTO audit_events (shop_id, action, subject_type) VALUES ($1, $2, 'seed')`,
          [id, `seed.c.${i}`],
        );
      }
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  },
});
