// STUB: replace with real IBJA scraper/API when credentials obtained
// See: https://www.ibja.co/ for API onboarding
// GOLD_24K ≈ ₹7,350/g → 735000 paise
import type { RatesPort, PurityRates, RatesResult } from './port';
import { RatesAdapterError } from './errors';

export class IbjaAdapter implements RatesPort {
  getName(): string {
    return 'ibja';
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
    const TIMEOUT_MS = 5000;
    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      // nosemgrep: goldsmith.als-boundary-preserved -- HTTP timeout detaches intentionally; no tenant context needed
      timer = setTimeout(
        () => reject(new RatesAdapterError(this.getName(), new Error('Request timeout'))),
        TIMEOUT_MS,
      );
    });
    try {
      const rates = await Promise.race([this._fetch(), timeoutPromise]);
      clearTimeout(timer!);
      return { rates, source: this.getName(), stale: false };
    } catch (err) {
      clearTimeout(timer!);
      if (err instanceof RatesAdapterError) throw err;
      throw new RatesAdapterError(this.getName(), err);
    }
  }
}
