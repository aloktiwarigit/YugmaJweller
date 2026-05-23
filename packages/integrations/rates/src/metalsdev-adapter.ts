// Placeholder adapter for Metals.dev (credentials not yet obtained).
// Throws MetalsDevUnavailableError rather than returning a hardcoded value
// so the FallbackChain always falls through to the LKG cache instead of
// silently serving stale stub data.
// See: https://metals.dev/ for API onboarding.
import type { RatesPort, PurityRates, RatesResult } from './port';
import { RatesAdapterError, MetalsDevUnavailableError } from './errors';

export class MetalsDevAdapter implements RatesPort {
  getName(): string {
    return 'metalsdev';
  }

  // Overridable in tests to simulate specific failure modes
  protected async _fetch(): Promise<PurityRates> {
    throw new MetalsDevUnavailableError();
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
