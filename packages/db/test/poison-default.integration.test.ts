import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { createPool, POISON_UUID } from '../src/provider';

let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();
  pool = createPool({ connectionString: container.getConnectionUri() });
  const c = await pool.connect();
  await c.query(`
    CREATE TABLE demo (id SERIAL PRIMARY KEY, shop_id UUID NOT NULL, data TEXT);
    INSERT INTO demo (shop_id, data) VALUES
      ('11111111-1111-1111-1111-111111111111', 'a'),
      ('22222222-2222-2222-2222-222222222222', 'b');
    ALTER TABLE demo ENABLE ROW LEVEL SECURITY;
    CREATE POLICY rls_demo ON demo FOR ALL
      USING (shop_id = current_setting('app.current_shop_id', true)::uuid)
      WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);
    CREATE ROLE app_user NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'x';
    GRANT SELECT, INSERT, UPDATE, DELETE ON demo TO app_user;
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
  `);
  c.release();
}, 60_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('connection pool poison default', () => {
  it('sets poison UUID on checkout so unscoped SELECT returns 0 rows', async () => {
    const appPool = createPool({
      connectionString: container.getConnectionUri().replace('test:test', 'app_user:x'),
    });
    const client = await appPool.connect();
    const { rows } = await client.query('SELECT * FROM demo');
    expect(rows).toHaveLength(0);
    const { rows: setting } = await client.query(`SELECT current_setting('app.current_shop_id', true) AS v`);
    expect(setting[0].v).toBe(POISON_UUID);
    client.release();
    await appPool.end();
  });
});
