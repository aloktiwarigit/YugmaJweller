import type { Pool } from 'pg';
import { fixtureRegistry } from './registry';

export const TENANT_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

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
        `INSERT INTO shop_users (shop_id, phone, display_name, role, status) VALUES
          ($1,'+91AAA001','Alice A','shop_admin','ACTIVE'),
          ($1,'+91AAA002','Akhil A','shop_staff','ACTIVE')`,
        [id],
      );
      for (let i = 1; i <= 5; i++) {
        await c.query(
          `INSERT INTO audit_events (shop_id, action, subject_type) VALUES ($1, $2, 'seed')`,
          [id, `seed.a.${i}`],
        );
      }
      await c.query('RESET ROLE');
    } finally { c.release(); }
  },
});
