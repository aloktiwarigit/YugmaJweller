import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import type { Redis } from '@goldsmith/cache';
import { FallbackChain } from '@goldsmith/rates';
import type { PurityRates } from '@goldsmith/rates';
import { AuditAction } from '@goldsmith/audit';
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

// ---------------------------------------------------------------------------
// Serialization helpers (bigint cannot be JSON.stringify'd natively)
// ---------------------------------------------------------------------------

type PurityKey = keyof PurityRates;

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

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly fallbackChain: FallbackChain,
    @Inject('PRICING_REDIS') private readonly redis: Redis,
  ) {}

  // -------------------------------------------------------------------------
  // getCurrentRates — try Redis cache first, fall back to FallbackChain
  // -------------------------------------------------------------------------
  async getCurrentRates(): Promise<CurrentRatesResult> {
    const cached = await this.redis.get(REDIS_KEY_CURRENT);
    if (cached !== null) {
      let parsed: CachedCurrentRates | null = null;
      try {
        parsed = deserializeRates(cached);
      } catch {
        // Malformed JSON — treat as cache miss and evict
        this.logger.warn('Cached rates entry is malformed — evicting and falling through to FallbackChain');
        await this.redis.del(REDIS_KEY_CURRENT);
      }

      if (parsed !== null) {
      // Guard: if any required purity key is missing (stale/incompatible schema from a
      // previous deployment), treat as a cache miss rather than crashing with BigInt(undefined).
      const requiredKeys = ['GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K', 'SILVER_999', 'SILVER_925'] as const;
      if (requiredKeys.some(k => !parsed[k])) {
        this.logger.warn('Cached rates schema is stale/incompatible — evicting and falling through to FallbackChain');
        await this.redis.del(REDIS_KEY_CURRENT);
        // Fall through to FallbackChain below
      } else {
        // Re-hydrate bigints
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
      }
      } // end if (parsed !== null)
    }

    // Cache miss — call FallbackChain (throws RatesUnavailableError if all sources fail)
    const liveResult = await this.fallbackChain.getRatesByPurity();
    const { rates: liveRates, source, stale } = liveResult;

    // Only cache live rates — skip Redis write for LKG to avoid locking in stale data
    if (source !== 'last_known_good') {
      const serialized = serializeRates(liveRates, stale, source);
      await this.redis.setex(REDIS_KEY_CURRENT, TTL_CURRENT_CACHE_SEC, serialized);
    }

    return { ...liveRates, stale, source };
  }

  // -------------------------------------------------------------------------
  // refreshRates — called by BullMQ worker on schedule
  // -------------------------------------------------------------------------
  async refreshRates(): Promise<void> {
    const { rates, source, stale } = await this.fallbackChain.getRatesByPurity();

    // 1. Write to Redis 'rates:current' with 30-min TTL
    const serialized = serializeRates(rates, stale, source);
    await this.redis.setex(REDIS_KEY_CURRENT, TTL_REFRESH_SEC, serialized);

    // 2. Insert snapshot only for live fetches — LKG cache hits are stale and would skew history
    if (source === 'last_known_good') {
      this.logger.warn(`Rates served from last_known_good cache (stale=${String(stale)}) — skipping snapshot insert`);
      return;
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
}
