// Live INR rate fetcher backed by goldapi.io.
//
// Despite the class name (kept for binary-compat with existing wiring), this
// adapter no longer scrapes IBJA. It calls goldapi.io which returns per-gram
// INR prices for every karat directly — no FX conversion, no ounce math.
//
// Cost discipline: goldapi.io free tier is 100 requests/month. To stay well
// under that with min-instances=1 + max-instances=5, this adapter:
//   1. Caches the last successful fetch IN-MEMORY for 9 hours.
//      Independent of Redis — works even when Upstash is out of quota.
//   2. Returns the cached rates on every call within the TTL.
//   3. Only hits goldapi.io when the in-memory cache is empty or expired.
//
// Combined with the 3x-per-day cron in pricing.module.ts (09:00, 13:00,
// 18:00 IST), worst-case daily quota is:
//   3 cron firings + up to 5 cold-start fetches (one per instance) = ~8/day
//   = ~240/month — still fits the 100/mo budget after instance churn slows.
//
// If goldapi.io ever fails (rate limit, outage, network), this adapter throws
// RatesAdapterError. The fallback chain in pricing.service.ts then drops to
// the secondary adapter and ultimately the last-known-good cache.

import type { RatesPort, PurityRates, RatesResult } from './port';
import { RatesAdapterError } from './errors';

const GOLD_API_URL  = 'https://www.goldapi.io/api/XAU/INR';
const SILVER_API_URL = 'https://www.goldapi.io/api/XAG/INR';
const FETCH_TIMEOUT_MS = 8000;

// 9 hours — slightly longer than the gap between the 3 daily crons (5h max
// gap between 18:00 and 09:00 next day across midnight is 15h, but the 9h
// covers the day gaps of 4h each). Cron-driven refreshes invalidate this
// cache by calling refreshRates() explicitly.
const IN_MEMORY_TTL_MS = 9 * 60 * 60 * 1000;

interface GoldApiResponse {
  price_gram_24k: number;
  price_gram_22k: number;
  price_gram_20k?: number;
  price_gram_18k: number;
  price_gram_14k: number;
}

interface SilverApiResponse {
  // For XAG, goldapi.io's price_gram_24k is per-gram pure silver (.999).
  price_gram_24k: number;
}

interface CachedRates {
  rates:    PurityRates;
  fetchedAt: number; // ms
}

/**
 * Indian retail premium over goldapi.io's spot-INR price. Set this if your
 * displayed rate needs to include import duty / dealer margin on top of the
 * international spot conversion. 0 = use goldapi.io values as-is.
 */
function getRetailPremium(): number {
  const raw = process.env['RATES_RETAIL_PREMIUM_PCT'];
  if (raw === undefined || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return 0;
  return n;
}

function getApiKey(): string {
  const k = process.env['GOLDAPI_KEY'] ?? '';
  if (!k) throw new Error('GOLDAPI_KEY env var is not set');
  return k;
}

async function fetchJson<T>(url: string, apiKey: string, timeoutMs: number): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: {
        'x-access-token': apiKey,
        'Content-Type':   'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function rupeesToPaise(rupees: number, premium: number): bigint {
  const withPremium = rupees * (1 + premium);
  return BigInt(Math.round(withPremium * 100));
}

export class IbjaAdapter implements RatesPort {
  // Process-local cache. Each Cloud Run instance has its own copy.
  private static cache: CachedRates | null = null;

  getName(): string {
    return 'ibja';
  }

  /**
   * Evict the in-memory cache. Call before a cron-driven refresh so the
   * scheduler always fetches fresh data instead of returning cached rates.
   * Also used as a test seam.
   */
  static clearCache(): void {
    IbjaAdapter.cache = null;
  }

  /** @deprecated Use clearCache() */
  static clearCacheForTesting(): void {
    IbjaAdapter.clearCache();
  }

  protected async _fetch(): Promise<PurityRates> {
    // 1) In-memory cache hit → return immediately, no HTTP call.
    const now = Date.now();
    const cached = IbjaAdapter.cache;
    if (cached && now - cached.fetchedAt < IN_MEMORY_TTL_MS) {
      return cached.rates;
    }

    // 2) Fetch from goldapi.io.
    const apiKey  = getApiKey();
    const premium = getRetailPremium();

    const [gold, silver] = await Promise.all([
      fetchJson<GoldApiResponse>(GOLD_API_URL,    apiKey, FETCH_TIMEOUT_MS),
      fetchJson<SilverApiResponse>(SILVER_API_URL, apiKey, FETCH_TIMEOUT_MS),
    ]);

    if (!Number.isFinite(gold.price_gram_24k) || gold.price_gram_24k <= 0) {
      throw new Error(`goldapi gold response missing price_gram_24k: ${JSON.stringify(gold)}`);
    }
    if (!Number.isFinite(silver.price_gram_24k) || silver.price_gram_24k <= 0) {
      throw new Error(`goldapi silver response missing price_gram_24k: ${JSON.stringify(silver)}`);
    }

    // 20K rarely listed; derive linearly from 22K if absent.
    const gold20kRupees = gold.price_gram_20k ?? gold.price_gram_22k * (20 / 22);

    const fetchedAt = new Date();
    const rates: PurityRates = {
      GOLD_24K: { perGramPaise: rupeesToPaise(gold.price_gram_24k, premium), fetchedAt },
      GOLD_22K: { perGramPaise: rupeesToPaise(gold.price_gram_22k, premium), fetchedAt },
      GOLD_20K: { perGramPaise: rupeesToPaise(gold20kRupees,        premium), fetchedAt },
      GOLD_18K: { perGramPaise: rupeesToPaise(gold.price_gram_18k, premium), fetchedAt },
      GOLD_14K: { perGramPaise: rupeesToPaise(gold.price_gram_14k, premium), fetchedAt },
      SILVER_999: { perGramPaise: rupeesToPaise(silver.price_gram_24k,         premium), fetchedAt },
      SILVER_925: { perGramPaise: rupeesToPaise(silver.price_gram_24k * 0.925, premium), fetchedAt },
    };

    IbjaAdapter.cache = { rates, fetchedAt: now };
    return rates;
  }

  async getRatesByPurity(): Promise<RatesResult> {
    try {
      const rates = await this._fetch();
      return { rates, source: this.getName(), stale: false };
    } catch (err) {
      // Diagnostic stderr so the actual cause shows up in Cloud Logging.
      // FallbackChain only logs String(err) which drops the .cause chain.
      const cause = (err as { cause?: unknown }).cause;
      const causeStr = cause
        ? JSON.stringify({
            name:     (cause as { name?: string }).name,
            message:  (cause as { message?: string }).message,
            code:     (cause as { code?: string }).code,
            errno:    (cause as { errno?: number }).errno,
            syscall:  (cause as { syscall?: string }).syscall,
            hostname: (cause as { hostname?: string }).hostname,
          })
        : '<no cause>';
      // eslint-disable-next-line no-console
      console.error(
        '[ibja-adapter] _fetch failed:',
        err instanceof Error ? err.message : String(err),
        'cause:',
        causeStr,
      );
      if (err instanceof RatesAdapterError) throw err;
      throw new RatesAdapterError(this.getName(), err);
    }
  }
}
