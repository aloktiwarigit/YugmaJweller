import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createPool, runMigrations } from '@goldsmith/db';
import { AuthRepository } from '../src/modules/auth/auth.repository';

describe('auth_lookup_user_by_phone — disambiguation (Fix 2, migration 0005)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let repo: AuthRepository;

  const SHOP_A = 'aaaaaaaa-0000-0000-0000-000000000001';
  const SHOP_B = 'bbbbbbbb-0000-0000-0000-000000000002';
  const SHOP_C = 'cccccccc-0000-0000-0000-000000000003';

  const PHONE_SINGLE = '+919000012345';
  const PHONE_MULTI  = '+919000012346';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15.6').start();
    pool = createPool({ connectionString: container.getConnectionUri() });
    await runMigrations(pool, resolve(__dirname, '../../../packages/db/src/migrations'));
    repo = new AuthRepository(pool);

    // Seed SHOP_A — single active shop for PHONE_SINGLE
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status)
       VALUES ($1, 'dup-a', 'Shop A', 'ACTIVE') ON CONFLICT DO NOTHING`,
      [SHOP_A],
    );
    await pool.query(
      `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
       VALUES ($1, $2, 'Owner A', 'shop_admin', 'INVITED')`,
      [SHOP_A, PHONE_SINGLE],
    );

    // Seed SHOP_B and SHOP_C — both active, both have PHONE_MULTI (ambiguous)
    await pool.query(
      `INSERT INTO shops (id, slug, display_name, status)
       VALUES ($1, 'dup-b', 'Shop B', 'ACTIVE'), ($2, 'dup-c', 'Shop C', 'ACTIVE')
       ON CONFLICT DO NOTHING`,
      [SHOP_B, SHOP_C],
    );
    await pool.query(
      `INSERT INTO shop_users (shop_id, phone, display_name, role, status)
       VALUES ($1, $2, 'Owner B', 'shop_admin', 'INVITED'),
              ($3, $2, 'Owner C', 'shop_admin', 'INVITED')`,
      [SHOP_B, PHONE_MULTI, SHOP_C],
    );
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it('same phone in exactly one active shop → returns that row', async () => {
    const row = await repo.lookupByPhone(PHONE_SINGLE);
    expect(row).not.toBeNull();
    expect(row?.shopId).toBe(SHOP_A);
  });

  it('same phone in two active shops → returns null (disambiguation guard)', async () => {
    const row = await repo.lookupByPhone(PHONE_MULTI);
    expect(row).toBeNull();
  });

  it('unknown phone → returns null', async () => {
    const row = await repo.lookupByPhone('+919999999999');
    expect(row).toBeNull();
  });
});
