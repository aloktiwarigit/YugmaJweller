// Live spot-price fetcher.
//
// Despite the class name (kept for binary-compat with existing wiring),
// this adapter no longer scrapes IBJA. It pulls live spot prices from
// api.gold-api.com (USD per troy ounce, no API key required) and the
// daily USD/INR rate from open.er-api.com (free, no key), then converts:
//
//   INR / gram (24K) = (USD/oz) × (INR/USD) / 31.1035 × (1 + retail_premium)
//
// `retail_premium` defaults to 12% (Indian import duty proxy + dealer margin).
// Override with RATES_RETAIL_PREMIUM_PCT env var. Karat ratios are derived
// linearly from 24K. Silver computed from XAG the same way.
//
// Fallback: if either upstream fails, RatesAdapterError is thrown. The
// fallback-chain in pricing.service.ts then tries the next adapter, then
// the last-known-good cache in Redis.

import type { RatesPort, PurityRates, RatesResult } from './port';
import { RatesAdapterError } from './errors';

const GOLD_API_URL  = 'https://api.gold-api.com/price/XAU';
const SILVER_API_URL = 'https://api.gold-api.com/price/XAG';
const FX_API_URL    = 'https://open.er-api.com/v6/latest/USD';

const GRAMS_PER_TROY_OUNCE = 31.1034768;
const FETCH_TIMEOUT_MS     = 5000;

interface SpotPriceResponse { price: number }
interface FxResponse        { rates: { INR?: number } }

/**
 * Indian retail premium over spot. Covers import duty (~12.5%) plus typical
 * dealer margin. Configurable via env so it can be tuned without redeploy.
 */
function getRetailPremium(): number {
  const raw = process.env['RATES_RETAIL_PREMIUM_PCT'];
  if (raw === undefined || raw === '') return 0.12;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return 0.12;
  return n;
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function inrPerGramFromUsdPerOz(usdPerOz: number, usdToInr: number, premium: number): bigint {
  const inrPerGramSpot   = (usdPerOz * usdToInr) / GRAMS_PER_TROY_OUNCE;
  const inrPerGramRetail = inrPerGramSpot * (1 + premium);
  return BigInt(Math.round(inrPerGramRetail * 100)); // → paise
}

export class IbjaAdapter implements RatesPort {
  getName(): string {
    return 'ibja';
  }

  // Overridable in tests
  protected async _fetch(): Promise<PurityRates> {
    const now = new Date();
    const premium = getRetailPremium();

    // Three parallel fetches with a single timeout each
    const [gold, silver, fx] = await Promise.all([
      fetchJson<SpotPriceResponse>(GOLD_API_URL,   FETCH_TIMEOUT_MS),
      fetchJson<SpotPriceResponse>(SILVER_API_URL, FETCH_TIMEOUT_MS),
      fetchJson<FxResponse>(FX_API_URL,            FETCH_TIMEOUT_MS),
    ]);

    const usdToInr = fx.rates?.INR;
    if (!usdToInr || !Number.isFinite(usdToInr) || usdToInr <= 0) {
      throw new Error(`FX API returned invalid INR rate: ${String(usdToInr)}`);
    }
    if (!Number.isFinite(gold.price) || gold.price <= 0) {
      throw new Error(`Gold API returned invalid price: ${String(gold.price)}`);
    }
    if (!Number.isFinite(silver.price) || silver.price <= 0) {
      throw new Error(`Silver API returned invalid price: ${String(silver.price)}`);
    }

    const gold24kPaise = inrPerGramFromUsdPerOz(gold.price, usdToInr, premium);
    const silverPaise  = inrPerGramFromUsdPerOz(silver.price, usdToInr, premium);

    // Derive karats linearly. ratio = karat/24.
    const k = (ratio: number): bigint => BigInt(Math.round(Number(gold24kPaise) * ratio));

    return {
      GOLD_24K: { perGramPaise: gold24kPaise,         fetchedAt: now },
      GOLD_22K: { perGramPaise: k(22 / 24),           fetchedAt: now },
      GOLD_20K: { perGramPaise: k(20 / 24),           fetchedAt: now },
      GOLD_18K: { perGramPaise: k(18 / 24),           fetchedAt: now },
      GOLD_14K: { perGramPaise: k(14 / 24),           fetchedAt: now },
      SILVER_999: { perGramPaise: silverPaise,                       fetchedAt: now },
      // 925 silver = 92.5% of 999
      SILVER_925: { perGramPaise: BigInt(Math.round(Number(silverPaise) * 0.925)), fetchedAt: now },
    };
  }

  async getRatesByPurity(): Promise<RatesResult> {
    try {
      const rates = await this._fetch();
      return { rates, source: this.getName(), stale: false };
    } catch (err) {
      // Diagnostic stderr so the actual cause shows up in Cloud Logging.
      // FallbackChain only logs String(err) which drops the .cause chain;
      // Node fetch's TypeError("fetch failed") hides the real reason
      // (DNS / TLS / timeout) in err.cause.
      const cause = (err as { cause?: unknown }).cause;
      const causeStr = cause
        ? JSON.stringify({
            name:    (cause as { name?: string }).name,
            message: (cause as { message?: string }).message,
            code:    (cause as { code?: string }).code,
            errno:   (cause as { errno?: number }).errno,
            syscall: (cause as { syscall?: string }).syscall,
            hostname:(cause as { hostname?: string }).hostname,
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
