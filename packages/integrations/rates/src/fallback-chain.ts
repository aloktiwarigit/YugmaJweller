import type { RatesPort, PurityRates } from './port';
import { RatesUnavailableError } from './errors';
import type { LastKnownGoodCache } from './last-known-good-cache';

interface RatesLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export class FallbackChain implements RatesPort {
  constructor(
    private readonly primary: RatesPort,
    private readonly secondary: RatesPort,
    private readonly lastKnownGoodCache: LastKnownGoodCache,
    private readonly logger: RatesLogger,
  ) {}

  getName(): string {
    return 'fallback-chain';
  }

  async getRatesByPurity(): Promise<PurityRates> {
    // Tier 1: primary adapter
    try {
      const rates = await this.primary.getRatesByPurity();
      this.logger.log(`Rates served by primary (${this.primary.getName()})`);
      // Update LKG cache on success
      await this.lastKnownGoodCache.update(rates);
      return rates;
    } catch (primaryErr) {
      this.logger.warn(
        `Primary adapter (${this.primary.getName()}) failed: ${String(primaryErr)}`,
      );
    }

    // Tier 2: secondary adapter
    try {
      const rates = await this.secondary.getRatesByPurity();
      this.logger.log(`Rates served by secondary (${this.secondary.getName()})`);
      await this.lastKnownGoodCache.update(rates);
      return rates;
    } catch (secondaryErr) {
      this.logger.warn(
        `Secondary adapter (${this.secondary.getName()}) failed: ${String(secondaryErr)}`,
      );
    }

    // Tier 3: last-known-good cache
    const cached = await this.lastKnownGoodCache.get();
    if (cached !== null) {
      this.logger.warn(
        `Rates served from last-known-good cache (stale=${String(cached.stale)})`,
      );
      return cached.rates;
    }

    // All sources exhausted
    this.logger.error('All rate sources unavailable');
    throw new RatesUnavailableError();
  }
}
