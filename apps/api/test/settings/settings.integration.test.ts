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
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { createPool, runMigrations } from '@goldsmith/db';
import { tenantContext, type Tenant, type AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { SettingsRepository } from '../../src/modules/settings/settings.repository';
import { SettingsService } from '../../src/modules/settings/settings.service';
import { SettingsCache } from '@goldsmith/tenant-config';
import { DrizzleTenantLookup } from '../../src/drizzle-tenant-lookup';
import { LOYALTY_DEFAULTS, MAKING_CHARGE_DEFAULTS, WASTAGE_DEFAULTS } from '@goldsmith/shared';

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
  getProfile:             async () => null,
  setProfile:             async () => undefined,
  invalidate:             async () => undefined,
  getMakingCharges:       async () => null,
  setMakingCharges:       async () => undefined,
  invalidateMakingCharges: async () => undefined,
  getWastage:             async () => null,
  setWastage:             async () => undefined,
  invalidateWastage:      async () => undefined,
  getRateLock:            async () => null,
  setRateLock:            async () => undefined,
  invalidateRateLock:     async () => undefined,
  getLoyalty:             async () => null,
  setLoyalty:             async () => undefined,
  invalidateLoyalty:      async () => undefined,
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
        repo.getLoyalty(),
      );
      expect(config).toEqual(LOYALTY_DEFAULTS);
    });

    it('getLoyalty returns the stored config after upsertLoyalty', async () => {
      const custom = {
        ...LOYALTY_DEFAULTS,
        earnRatePercentage: '2.00',
      };
      await tenantContext.runWith(makeCtx(), () =>
        repo.upsertLoyalty(custom),
      );
      const config = await tenantContext.runWith(makeCtx(), () =>
        repo.getLoyalty(),
      );
      expect(config.earnRatePercentage).toBe('2.00');
      expect(config.tiers).toEqual(LOYALTY_DEFAULTS.tiers);
    });

    it('upsertLoyalty is idempotent — second call updates, no duplicate rows', async () => {
      const v1 = { ...LOYALTY_DEFAULTS, earnRatePercentage: '3.00' };
      const v2 = { ...LOYALTY_DEFAULTS, earnRatePercentage: '4.00' };
      await tenantContext.runWith(makeCtx(), () => repo.upsertLoyalty(v1));
      await tenantContext.runWith(makeCtx(), () => repo.upsertLoyalty(v2));

      const r = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM shop_settings WHERE shop_id = $1`,
        [SHOP_A],
      );
      expect(Number(r.rows[0].count)).toBe(1);

      const config = await tenantContext.runWith(makeCtx(), () =>
        repo.getLoyalty(),
      );
      expect(config.earnRatePercentage).toBe('4.00');
    });

    it('stored thresholdPaise values are integers', async () => {
      const config = await tenantContext.runWith(makeCtx(), () =>
        repo.getLoyalty(),
      );
      for (const tier of config.tiers) {
        expect(Number.isInteger(tier.thresholdPaise)).toBe(true);
      }
    });

    it('updateLoyalty type=tier persists tier name and converts rupees to paise', async () => {
      const result = await tenantContext.runWith(makeCtx(), () =>
        svc.updateLoyalty({
          type:            'tier',
          index:           0,
          name:            'Bronze',
          thresholdRupees: '25000',
          badgeColor:      '#CD7F32',
        }),
      );

      expect(result.ok).toBe(true);

      const config = await tenantContext.runWith(makeCtx(), () =>
        repo.getLoyalty(),
      );
      // 25000 rupees × 100 = 2,500,000 paise
      expect(config.tiers[0].name).toBe('Bronze');
      expect(config.tiers[0].thresholdPaise).toBe(2_500_000);
      expect(config.tiers[0].badgeColor).toBe('#CD7F32');
    });

    it('updateLoyalty type=rate persists both earn and redemption rates', async () => {
      const result = await tenantContext.runWith(makeCtx(), () =>
        svc.updateLoyalty({
          type:                     'rate',
          earnRatePercentage:       '2.50',
          redemptionRatePercentage: '0.50',
        }),
      );

      expect(result.ok).toBe(true);

      const config = await tenantContext.runWith(makeCtx(), () =>
        repo.getLoyalty(),
      );
      expect(config.earnRatePercentage).toBe('2.50');
      expect(config.redemptionRatePercentage).toBe('0.50');
    });

    it('updateLoyalty type=tier returns TIER_ORDER_INVALID when order is violated', async () => {
      // First reset to defaults so thresholds are predictable
      await tenantContext.runWith(makeCtx(), () =>
        repo.upsertLoyalty({
          tiers: [
            { name: 'Silver',  thresholdPaise: 5_000_000,  badgeColor: '#C0C0C0' },
            { name: 'Gold',    thresholdPaise: 15_000_000,  badgeColor: '#FFD700' },
            { name: 'Diamond', thresholdPaise: 50_000_000,  badgeColor: '#B9F2FF' },
          ],
          earnRatePercentage:       '1.00',
          redemptionRatePercentage: '1.00',
        }),
      );

      // tier[0] default is Rs 50,000; set tier[1] to Rs 40,000 — violates ascending order
      const result = await tenantContext.runWith(makeCtx(), () =>
        svc.updateLoyalty({
          type:            'tier',
          index:           1,
          name:            'Gold',
          thresholdRupees: '40000',
          badgeColor:      '#FFD700',
        }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('TIER_ORDER_INVALID');
      }
    });
  });
});

describe('getMakingCharges / updateMakingCharges integration', () => {
  it('getMakingCharges returns MAKING_CHARGE_DEFAULTS for a fresh shop (null JSONB)', async () => {
    const configs = await tenantContext.runWith(makeCtx(), () =>
      svc.getMakingCharges(),
    );
    expect(configs).toEqual(MAKING_CHARGE_DEFAULTS);
    expect(configs[0].category).toBe('RINGS');
  });

  it('PATCH → DB → GET round-trip: "10.00" in → "10.00" out (precision preserved as string)', async () => {
    await tenantContext.runWith(makeCtx(), () =>
      svc.updateMakingCharges([{ category: 'BRIDAL', type: 'percent', value: '10.00' }]),
    );

    // Verify the DB column directly (bypasses cache which always misses).
    const r = await pool.query<{ making_charges_json: unknown }>(
      'SELECT making_charges_json FROM shop_settings WHERE shop_id = $1',
      [SHOP_A],
    );
    const stored = r.rows[0].making_charges_json as Array<{ category: string; value: unknown }>;
    const bridal = stored.find((c) => c.category === 'BRIDAL');
    expect(bridal?.value).toBe('10.00');
    expect(typeof bridal?.value).toBe('string'); // ADR-0003: not a number
  });

  it('GET after PATCH returns the persisted merged values', async () => {
    const configs = await tenantContext.runWith(makeCtx(), () =>
      svc.getMakingCharges(),
    );
    const bridal = configs.find((c) => c.category === 'BRIDAL');
    expect(bridal?.value).toBe('10.00');
    // RINGS should retain its default
    const rings = configs.find((c) => c.category === 'RINGS');
    expect(rings?.value).toBe('12.00');
  });
});

describe('getWastage / updateWastage integration', () => {
  it('getWastage returns WASTAGE_DEFAULTS for a fresh shop (null JSONB)', async () => {
    const configs = await tenantContext.runWith(makeCtx(), () =>
      svc.getWastage(),
    );
    expect(configs).toEqual(WASTAGE_DEFAULTS);
    expect(configs[0].category).toBe('RINGS');
  });

  it('PATCH → DB → GET round-trip: "2.50" in → "2.50" out (string not float)', async () => {
    await tenantContext.runWith(makeCtx(), () =>
      svc.updateWastage({ category: 'BRIDAL', percent: '2.50' }),
    );

    const r = await pool.query<{ wastage_json: unknown }>(
      'SELECT wastage_json FROM shop_settings WHERE shop_id = $1',
      [SHOP_A],
    );
    const stored = r.rows[0].wastage_json as Record<string, unknown>;
    expect(stored['BRIDAL']).toBe('2.50');
    expect(typeof stored['BRIDAL']).toBe('string');
  });

  it('GET after PATCH returns persisted merged values; other categories keep defaults', async () => {
    const configs = await tenantContext.runWith(makeCtx(), () =>
      svc.getWastage(),
    );
    const bridal = configs.find((c) => c.category === 'BRIDAL');
    expect(bridal?.percent).toBe('2.50');
    const rings = configs.find((c) => c.category === 'RINGS');
    expect(rings?.percent).toBe('2.00');
  });

  it('PATCH with percent > 30 throws UnprocessableEntityException', async () => {
    const { UnprocessableEntityException } = await import('@nestjs/common');
    await expect(
      tenantContext.runWith(makeCtx(), () =>
        svc.updateWastage({ category: 'RINGS', percent: '50' }),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('DECIMAL precision preserved: "1.50" stored as "1.50" not 1.5', async () => {
    await tenantContext.runWith(makeCtx(), () =>
      svc.updateWastage({ category: 'CHAINS', percent: '1.50' }),
    );
    const r = await pool.query<{ wastage_json: unknown }>(
      'SELECT wastage_json FROM shop_settings WHERE shop_id = $1',
      [SHOP_A],
    );
    const stored = r.rows[0].wastage_json as Record<string, unknown>;
    expect(stored['CHAINS']).toBe('1.50');
  });
});

describe('rate-lock', () => {
  const rateLockCtx: AuthenticatedTenantContext = {
    shopId: SHOP_A, tenant, authenticated: true, userId: 'u1', role: 'shop_admin',
  };

  it('returns default 7 when never configured', async () => {
    const days = await tenantContext.runWith(rateLockCtx, () => svc.getRateLock());
    expect(days).toBe(7);
  });

  it('PATCH 14 → GET returns 14', async () => {
    await tenantContext.runWith(rateLockCtx, () =>
      svc.updateRateLock({ rateLockDays: 14 }),
    );
    const days = await tenantContext.runWith(rateLockCtx, () => svc.getRateLock());
    expect(days).toBe(14);
  });

  it('PATCH 30 → GET returns 30 (upper boundary)', async () => {
    await tenantContext.runWith(rateLockCtx, () =>
      svc.updateRateLock({ rateLockDays: 30 }),
    );
    const days = await tenantContext.runWith(rateLockCtx, () => svc.getRateLock());
    expect(days).toBe(30);
  });

  it('PATCH 1 → GET returns 1 (lower boundary)', async () => {
    await tenantContext.runWith(rateLockCtx, () =>
      svc.updateRateLock({ rateLockDays: 1 }),
    );
    const days = await tenantContext.runWith(rateLockCtx, () => svc.getRateLock());
    expect(days).toBe(1);
  });

  it('PATCH 31 → throws UnprocessableEntityException (422)', async () => {
    await expect(
      tenantContext.runWith(rateLockCtx, () =>
        svc.updateRateLock({ rateLockDays: 31 }),
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('PATCH 0 → throws UnprocessableEntityException (422)', async () => {
    await expect(
      tenantContext.runWith(rateLockCtx, () =>
        svc.updateRateLock({ rateLockDays: 0 }),
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('shop_manager role can read via service (role enforcement is at controller layer)', async () => {
    const managerCtx: AuthenticatedTenantContext = {
      shopId: SHOP_A, tenant, authenticated: true, userId: 'u2', role: 'shop_manager',
    };
    const days = await tenantContext.runWith(managerCtx, () => svc.getRateLock());
    expect(days).toBe(1);
  });
});
