// STUB: replace with real Metals.dev API when credentials obtained
// See: https://metals.dev/ for API onboarding
// GOLD_24K ≈ ₹7,350/g → 735000 paise
import type { RatesPort, PurityRates, RatesResult } from './port';
import { RatesAdapterError } from './errors';

export class MetalsDevAdapter implements RatesPort {
  getName(): string {
    return 'metalsdev';
  }

  // Overridable in tests to simulate fetch failures
  protected async _fetch(): Promise<PurityRates> {
    const now = new Date();
    return {
      GOLD_24K: { perGramPaise: 735000n, fetchedAt: now },
      GOLD_22K: { perGramPaise: 673750n, fetchedAt: now },
      GOLD_20K: { perGramPaise: 612500n, fetchedAt: now },
      GOLD_18K: { perGramPaise: 551250n, fetchedAt: now },
      GOLD_14K: { perGramPaise: 428750n, fetchedAt: now },
      SILVER_999: { perGramPaise: 9500n, fetchedAt: now },
      SILVER_925: { perGramPaise: 8788n, fetchedAt: now },
    };
  }

  async getRatesByPurity(): Promise<RatesResult> {
    try {
      const rates = await this._fetch();
      return { rates, source: this.getName(), stale: false };
    } catch (err) {
      throw new RatesAdapterError(this.getName(), err);
    }
  }
}
