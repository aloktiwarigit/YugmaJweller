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
    } finally {
      await c.query('RESET ROLE').catch(() => undefined);
      c.release();
    }
  },
});
