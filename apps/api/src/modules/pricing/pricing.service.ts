import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import type { Redis } from '@goldsmith/cache';
import { FallbackChain } from '@goldsmith/rates';
import type { PurityRates } from '@goldsmith/rates';
import { AuditAction } from '@goldsmith/audit';
import { withTenantTx } from '@goldsmith/db';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';
import { Decimal } from 'decimal.js';
import type { PurityKey } from '@goldsmith/shared';

export interface RateSnapshotRow {
  id: string;
  fetched_at: Date;
  source: string;
  gold_24k_paise: bigint;
  gold_22k_paise: bigint;
  gold_20k_paise: bigint;
  gold_18k_paise: bigint;
  gold_14k_paise: bigint;
  silver_999_paise: bigint;
  silver_925_paise: bigint;
  stale: boolean;
  created_at: Date;
}

const REDIS_KEY_CURRENT = 'rates:current';
const TTL_CURRENT_CACHE_SEC = 900;   // 15 min — on cache miss, after FallbackChain call
const TTL_REFRESH_SEC = 1800;        // 30 min — on explicit refreshRates()

// Redis TTL cap for override cache entries (10 minutes)
const TTL_OVERRIDE_MAX_SEC = 600;

// IST is UTC+5:30
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function endOfDayIST(): Date {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  nowIST.setUTCHours(23, 59, 59, 999);
  return new Date(nowIST.getTime() - IST_OFFSET_MS);
}

function overrideRedisKey(ctx: AuthenticatedTenantContext, purity: string): string {
  return `rates:override:${ctx.shopId}:${purity}`;
}

// ---------------------------------------------------------------------------
// Serialization helpers (bigint cannot be JSON.stringify'd natively)
// ---------------------------------------------------------------------------

interface SerializedEntry {
  perGramPaise: string;
  fetchedAt: string;
}

interface CachedCurrentRates {
  GOLD_24K: SerializedEntry;
  GOLD_22K: SerializedEntry;
  GOLD_20K: SerializedEntry;
  GOLD_18K: SerializedEntry;
  GOLD_14K: SerializedEntry;
  SILVER_999: SerializedEntry;
  SILVER_925: SerializedEntry;
  stale: boolean;
  source: string;
}

function serializeRates(
  rates: PurityRates,
  stale: boolean,
  source: string,
): string {
  const keys = Object.keys(rates) as PurityKey[];
  const out: Record<string, SerializedEntry | boolean | string> = {};
  for (const k of keys) {
    out[k] = {
      perGramPaise: rates[k].perGramPaise.toString(),
      fetchedAt: rates[k].fetchedAt.toISOString(),
    };
  }
  out['stale'] = stale;
  out['source'] = source;
  return JSON.stringify(out);
}

function deserializeRates(raw: string): CachedCurrentRates {
  return JSON.parse(raw) as CachedCurrentRates;
}

// ---------------------------------------------------------------------------
// PricingService
// ---------------------------------------------------------------------------

export interface CurrentRatesResult extends PurityRates {
  stale: boolean;
  source: string;
}

export interface ActiveOverride {
  overridePaise: bigint;
  validUntil: Date;
  reason: string;
}

export interface TenantRatesResult extends CurrentRatesResult {
  overriddenPurities: PurityKey[];
}

export interface SetOverrideDto {
  purity: PurityKey;
  overrideRupees: string;
  reason: string;
  validUntilIso?: string;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly fallbackChain: FallbackChain,
    @Inject('PRICING_REDIS') private readonly redis: Redis,
  ) {}

  private evictCache(): void {
    this.redis.del(REDIS_KEY_CURRENT).catch((e: unknown) =>
      this.logger.warn(`Cache eviction failed (best-effort): ${String(e)}`),
    );
  }

  // -------------------------------------------------------------------------
  // getCurrentRates — try Redis cache first, fall back to FallbackChain
  // -------------------------------------------------------------------------
  async getCurrentRates(): Promise<CurrentRatesResult> {
    let cached: string | null = null;
    try {
      cached = await this.redis.get(REDIS_KEY_CURRENT);
    } catch (redisErr) {
      this.logger.warn(`Redis unavailable in getCurrentRates — falling through to FallbackChain: ${String(redisErr)}`);
    }
    if (cached !== null) {
      let parsed: CachedCurrentRates | null = null;
      try {
        parsed = deserializeRates(cached);
      } catch {
        // Malformed JSON — treat as cache miss and evict
        this.logger.warn('Cached rates entry is malformed — evicting and falling through to FallbackChain');
        this.evictCache();
      }

      if (parsed !== null) {
      // Guard: if any required purity key is missing (stale/incompatible schema from a
      // previous deployment), treat as a cache miss rather than crashing with BigInt(undefined).
      const requiredKeys = ['GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K', 'SILVER_999', 'SILVER_925'] as const;
      if (requiredKeys.some(k => !parsed[k])) {
        this.logger.warn('Cached rates schema is stale/incompatible — evicting and falling through to FallbackChain');
        this.evictCache();
        // Fall through to FallbackChain below
      } else {
        // Re-hydrate bigints; treat invalid values as cache miss
        try {
          const rates: CurrentRatesResult = {
            GOLD_24K: { perGramPaise: BigInt(parsed.GOLD_24K.perGramPaise), fetchedAt: new Date(parsed.GOLD_24K.fetchedAt) },
            GOLD_22K: { perGramPaise: BigInt(parsed.GOLD_22K.perGramPaise), fetchedAt: new Date(parsed.GOLD_22K.fetchedAt) },
            GOLD_20K: { perGramPaise: BigInt(parsed.GOLD_20K.perGramPaise), fetchedAt: new Date(parsed.GOLD_20K.fetchedAt) },
            GOLD_18K: { perGramPaise: BigInt(parsed.GOLD_18K.perGramPaise), fetchedAt: new Date(parsed.GOLD_18K.fetchedAt) },
            GOLD_14K: { perGramPaise: BigInt(parsed.GOLD_14K.perGramPaise), fetchedAt: new Date(parsed.GOLD_14K.fetchedAt) },
            SILVER_999: { perGramPaise: BigInt(parsed.SILVER_999.perGramPaise), fetchedAt: new Date(parsed.SILVER_999.fetchedAt) },
            SILVER_925: { perGramPaise: BigInt(parsed.SILVER_925.perGramPaise), fetchedAt: new Date(parsed.SILVER_925.fetchedAt) },
            stale: parsed.stale,
            source: parsed.source,
          };
          return rates;
        } catch {
          this.logger.warn('Cached rates contain invalid field values — evicting and falling through to FallbackChain');
          this.evictCache();
        }
      }
      } // end if (parsed !== null)
    }

    // Cache miss — call FallbackChain (throws RatesUnavailableError if all sources fail)
    const liveResult = await this.fallbackChain.getRatesByPurity();
    const { rates: liveRates, source, stale } = liveResult;

    // Only cache live rates — skip Redis write for LKG; non-fatal if Redis write fails
    if (source !== 'last_known_good') {
      try {
        const serialized = serializeRates(liveRates, stale, source);
        await this.redis.setex(REDIS_KEY_CURRENT, TTL_CURRENT_CACHE_SEC, serialized);
      } catch (redisErr) {
        this.logger.warn(`Redis write failed in getCurrentRates — returning live rates without caching: ${String(redisErr)}`);
      }
    }

    return { ...liveRates, stale, source };
  }

  // -------------------------------------------------------------------------
  // refreshRates — called by BullMQ worker on schedule
  // -------------------------------------------------------------------------
  async refreshRates(): Promise<void> {
    const { rates, source, stale } = await this.fallbackChain.getRatesByPurity();

    // Skip Redis write and snapshot insert for LKG — stale data would pollute cache and history
    if (source === 'last_known_good') {
      this.logger.warn(`Rates served from last_known_good cache (stale=${String(stale)}) — skipping Redis write and snapshot insert`);
      return;
    }

    // 1. Write to Redis 'rates:current' with 30-min TTL (live data only); non-fatal if Redis is down
    try {
      const serialized = serializeRates(rates, stale, source);
      await this.redis.setex(REDIS_KEY_CURRENT, TTL_REFRESH_SEC, serialized);
    } catch (redisErr) {
      this.logger.warn(`Redis write failed in refreshRates — continuing to persist snapshot: ${String(redisErr)}`);
    }

    const snapshotValues = {
      fetched_at: rates.GOLD_24K.fetchedAt,
      source,
      gold_24k_paise: rates.GOLD_24K.perGramPaise,
      gold_22k_paise: rates.GOLD_22K.perGramPaise,
      gold_20k_paise: rates.GOLD_20K.perGramPaise,
      gold_18k_paise: rates.GOLD_18K.perGramPaise,
      gold_14k_paise: rates.GOLD_14K.perGramPaise,
      silver_999_paise: rates.SILVER_999.perGramPaise,
      silver_925_paise: rates.SILVER_925.perGramPaise,
      stale,
    };
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ibja_rate_snapshots
           (fetched_at, source,
            gold_24k_paise, gold_22k_paise, gold_20k_paise, gold_18k_paise, gold_14k_paise,
            silver_999_paise, silver_925_paise, stale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          snapshotValues.fetched_at,
          snapshotValues.source,
          snapshotValues.gold_24k_paise,
          snapshotValues.gold_22k_paise,
          snapshotValues.gold_20k_paise,
          snapshotValues.gold_18k_paise,
          snapshotValues.gold_14k_paise,
          snapshotValues.silver_999_paise,
          snapshotValues.silver_925_paise,
          snapshotValues.stale,
        ],
      );

      // 3. Log PRICING_RATES_REFRESHED platform audit event
      await client.query(
        `INSERT INTO platform_audit_events (action, metadata)
         VALUES ($1, $2)`,
        [
          AuditAction.PRICING_RATES_REFRESHED,
          JSON.stringify({ source, fetchedAt: rates.GOLD_24K.fetchedAt.toISOString() }),
        ],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    this.logger.log(`Rates refreshed from ${source} at ${rates.GOLD_24K.fetchedAt.toISOString()}`);
  }

  // -------------------------------------------------------------------------
  // getRateHistory — query ibja_rate_snapshots for historical data
  // -------------------------------------------------------------------------
  async getRateHistory(range: '30d' | '90d' | '365d'): Promise<RateSnapshotRow[]> {
    const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const client = await this.pool.connect();
    try {
      const result = await client.query<RateSnapshotRow>(
        `SELECT id, fetched_at, source,
                gold_24k_paise, gold_22k_paise, gold_20k_paise, gold_18k_paise, gold_14k_paise,
                silver_999_paise, silver_925_paise, stale, created_at
           FROM ibja_rate_snapshots
          WHERE fetched_at >= NOW() - ($1 * INTERVAL '1 day')
          ORDER BY fetched_at DESC`,
        [days],
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  // -------------------------------------------------------------------------
  // setOverride — shopkeeper manually overrides a purity rate for today
  // -------------------------------------------------------------------------
  async setOverride(
    ctx: AuthenticatedTenantContext,
    dto: SetOverrideDto,
  ): Promise<void> {
    const paise = BigInt(new Decimal(dto.overrideRupees).mul(100).toFixed(0));
    const validUntil = dto.validUntilIso ? new Date(dto.validUntilIso) : endOfDayIST();

    // Get current IBJA rate for before-value in audit log (best-effort; non-fatal)
    let beforePaise: string | null = null;
    try {
      const baseRates = await this.getCurrentRates();
      beforePaise = baseRates[dto.purity].perGramPaise.toString();
    } catch {
      // Non-fatal — audit still written, just without before value
    }

    await withTenantTx(this.pool, async (tx) => {
      await tx.query(
        `INSERT INTO shop_rate_overrides
           (shop_id, purity, override_paise, reason, set_by_user_id, valid_until)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ctx.shopId, dto.purity, paise, dto.reason, ctx.userId, validUntil],
      );
      await tx.query(
        `INSERT INTO audit_events
           (shop_id, actor_user_id, action, subject_type, subject_id, before, after)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          ctx.shopId,
          ctx.userId,
          AuditAction.PRICING_RATE_OVERRIDE_SET,
          'rate_override',
          dto.purity,
          beforePaise !== null ? JSON.stringify({ perGramPaise: beforePaise }) : null,
          JSON.stringify({ perGramPaise: paise.toString(), reason: dto.reason }),
        ],
      );
    });

    // Invalidate cached override for this shop+purity (best-effort)
    this.redis.del(overrideRedisKey(ctx, dto.purity)).catch((e: unknown) =>
      this.logger.warn(`Override cache eviction failed: ${String(e)}`),
    );
  }

  // -------------------------------------------------------------------------
  // getActiveOverride — fetch the current active override for a shop+purity
  // -------------------------------------------------------------------------
  async getActiveOverride(
    ctx: AuthenticatedTenantContext,
    purity: PurityKey,
  ): Promise<ActiveOverride | null> {
    const key = overrideRedisKey(ctx, purity);

    // Redis hit
    let cached: string | null = null;
    try {
      cached = await this.redis.get(key);
    } catch {
      // Redis unavailable — fall through to DB
    }
    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached) as { overridePaise: string; validUntil: string; reason: string };
        return {
          overridePaise: BigInt(parsed.overridePaise),
          validUntil: new Date(parsed.validUntil),
          reason: parsed.reason,
        };
      } catch {
        // Malformed — evict and fall through
        this.redis.del(key).catch(() => undefined);
      }
    }

    // DB query through withTenantTx (RLS-enforced)
    const row = await withTenantTx(this.pool, async (tx) => {
      const result = await tx.query<{ override_paise: bigint; valid_until: Date; reason: string }>(
        `SELECT override_paise, valid_until, reason
           FROM shop_rate_overrides
          WHERE purity = $1
            AND valid_until > now()
          ORDER BY valid_from DESC
          LIMIT 1`,
        [purity],
      );
      return result.rows[0] ?? null;
    });

    if (row === null) return null;

    const override: ActiveOverride = {
      overridePaise: BigInt(row.override_paise),
      validUntil: row.valid_until,
      reason: row.reason,
    };

    // Cache result until validUntil (capped at TTL_OVERRIDE_MAX_SEC)
    const ttlSec = Math.min(
      Math.max(0, Math.floor((override.validUntil.getTime() - Date.now()) / 1000)),
      TTL_OVERRIDE_MAX_SEC,
    );
    if (ttlSec > 0) {
      this.redis
        .setex(
          key,
          ttlSec,
          JSON.stringify({
            overridePaise: override.overridePaise.toString(),
            validUntil: override.validUntil.toISOString(),
            reason: override.reason,
          }),
        )
        .catch((e: unknown) =>
          this.logger.warn(`Override cache write failed: ${String(e)}`),
        );
    }

    return override;
  }

  // -------------------------------------------------------------------------
  // getCurrentRatesForTenant — base rates with per-tenant overrides applied
  // -------------------------------------------------------------------------
  async getCurrentRatesForTenant(ctx: AuthenticatedTenantContext): Promise<TenantRatesResult> {
    const base = await this.getCurrentRates();
    const purities: PurityKey[] = [
      'GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K', 'SILVER_999', 'SILVER_925',
    ];

    const overrides = await Promise.all(
      purities.map((p) => this.getActiveOverride(ctx, p)),
    );

    const merged = { ...base };
    const overriddenPurities: PurityKey[] = [];

    purities.forEach((purity, i) => {
      const ov = overrides[i];
      if (ov !== null) {
        merged[purity] = { perGramPaise: ov.overridePaise, fetchedAt: base[purity].fetchedAt };
        overriddenPurities.push(purity);
      }
    });

    return { ...merged, overriddenPurities };
  }
}
