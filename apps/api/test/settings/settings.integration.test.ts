// apps/api/test/settings/settings.integration.test.ts
//
// Integration tests for SettingsRepository + SettingsService against a real
// Postgres testcontainer. Runs migrations, seeds one shop row, then exercises
// the service layer.
//
// Tier: Class B integration test — no Firebase emulator needed, no NestJS
// application bootstrap. We instantiate Repository and Service directly.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { createPool, runMigrations } from '@goldsmith/db';
import { tenantContext, type Tenant, type AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { SettingsRepository } from '../../src/modules/settings/settings.repository';
import { SettingsService } from '../../src/modules/settings/settings.service';
import { SettingsCache } from '@goldsmith/tenant-config';
import { DrizzleTenantLookup } from '../../src/drizzle-tenant-lookup';
import { LOYALTY_DEFAULTS } from '@goldsmith/shared';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SHOP_A = '11111111-1111-1111-1111-111111111111';

const tenant: Tenant = {
  id: SHOP_A,
  slug: 'anchor-dev',
  display_name: 'Rajesh Jewellers',
  status: 'ACTIVE',
};

// Cache that always misses — forces DB reads so we can verify persistence.
const mockCache = {
  getProfile: async () => null,
  setProfile: async () => undefined,
  invalidate: async () => undefined,
} as unknown as SettingsCache;

// ─── Test harness ─────────────────────────────────────────────────────────────

let container: StartedPostgreSqlContainer;
let pool: Pool;
let repo: SettingsRepository;
let svc: SettingsService;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:15.6').start();

  // Use createPool so the on-connect poison-default GUC hook is installed.
  // Migrations include 0000_roles.sql which creates app_user idempotently.
  pool = createPool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool, resolve(__dirname, '../../../../packages/db/src/migrations'));

  // Seed one shop row as superuser (pool bypasses RLS while still in superuser role).
  await pool.query(
    `INSERT INTO shops (id, slug, display_name, status)
     VALUES ($1, $2, $3, 'ACTIVE')`,
    [SHOP_A, 'anchor-dev', 'Rajesh Jewellers'],
  );

  // Inject pool directly — no NestJS DI container needed.
  repo = new SettingsRepository(pool as never);

  // DrizzleTenantLookup just needs the pool (for cache invalidation path).
  const tenantLookup = new DrizzleTenantLookup(pool as never);

  svc = new SettingsService(
    repo as never,
    mockCache,
    tenantLookup as never,
    pool as never,
  );
}, 90_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(role: 'shop_admin' | 'shop_manager' | 'shop_staff' = 'shop_admin'): AuthenticatedTenantContext {
  return {
    shopId: SHOP_A,
    tenant,
    authenticated: true,
    userId: 'user-a',
    role,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SettingsRepository + SettingsService integration', () => {
  it('getProfile returns name from DB and null for unfilled optional fields', async () => {
    const profile = await tenantContext.runWith(makeCtx(), () =>
      svc.getProfile(),
    );

    expect(profile.name).toBe('Rajesh Jewellers');
    expect(profile.gstin).toBeNull();
    expect(profile.address).toBeNull();
    expect(profile.contact_phone).toBeNull();
    expect(profile.about_text).toBeNull();
  });

  it('updateProfile persists name change to DB', async () => {
    await tenantContext.runWith(makeCtx(), () =>
      svc.updateProfile( { name: 'Rajesh Jewellers & Sons' }),
    );

    const r = await pool.query<{ display_name: string }>(
      'SELECT display_name FROM shops WHERE id = $1',
      [SHOP_A],
    );
    expect(r.rows[0].display_name).toBe('Rajesh Jewellers & Sons');
  });

  it('creates shop_settings skeleton row on first update', async () => {
    // Verified via superuser connection so RLS does not filter the result.
    const r = await pool.query<{ shop_id: string }>(
      'SELECT shop_id FROM shop_settings WHERE shop_id = $1',
      [SHOP_A],
    );
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].shop_id).toBe(SHOP_A);
  });

  it('rejects invalid GSTIN with BadRequestException', async () => {
    await expect(
      tenantContext.runWith(makeCtx(), () =>
        svc.updateProfile( { gstin: 'INVALID' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('after update + cache miss, getProfile returns updated data from DB', async () => {
    await tenantContext.runWith(makeCtx(), () =>
      svc.updateProfile( { about_text: 'प्रीमियम सोना और आभूषण' }),
    );

    // Cache always returns null → forces DB read.
    const profile = await tenantContext.runWith(makeCtx(), () =>
      svc.getProfile(),
    );

    expect(profile.about_text).toBe('प्रीमियम सोना और आभूषण');
  });

  describe('loyalty', () => {
    it('getLoyalty returns LOYALTY_DEFAULTS when shop has no loyalty_json set', async () => {
      // shop_settings row may not exist yet for this shop; either way loyalty_json is null
      const config = await tenantContext.runWith(makeCtx(), () =>
        repo.getLoyalty(SHOP_A),
      );
      expect(config).toEqual(LOYALTY_DEFAULTS);
    });

    it('getLoyalty returns the stored config after upsertLoyalty', async () => {
      const custom = {
        ...LOYALTY_DEFAULTS,
        earnRatePercentage: '2.00',
      };
      await tenantContext.runWith(makeCtx(), () =>
        repo.upsertLoyalty(SHOP_A, custom),
      );
      const config = await tenantContext.runWith(makeCtx(), () =>
        repo.getLoyalty(SHOP_A),
      );
      expect(config.earnRatePercentage).toBe('2.00');
      expect(config.tiers).toEqual(LOYALTY_DEFAULTS.tiers);
    });

    it('upsertLoyalty is idempotent — second call updates, no duplicate rows', async () => {
      const v1 = { ...LOYALTY_DEFAULTS, earnRatePercentage: '3.00' };
      const v2 = { ...LOYALTY_DEFAULTS, earnRatePercentage: '4.00' };
      await tenantContext.runWith(makeCtx(), () => repo.upsertLoyalty(SHOP_A, v1));
      await tenantContext.runWith(makeCtx(), () => repo.upsertLoyalty(SHOP_A, v2));

      const r = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM shop_settings WHERE shop_id = $1`,
        [SHOP_A],
      );
      expect(Number(r.rows[0].count)).toBe(1);

      const config = await tenantContext.runWith(makeCtx(), () =>
        repo.getLoyalty(SHOP_A),
      );
      expect(config.earnRatePercentage).toBe('4.00');
    });

    it('stored thresholdPaise values are integers', async () => {
      const config = await tenantContext.runWith(makeCtx(), () =>
        repo.getLoyalty(SHOP_A),
      );
      for (const tier of config.tiers) {
        expect(Number.isInteger(tier.thresholdPaise)).toBe(true);
      }
    });
  });
});
