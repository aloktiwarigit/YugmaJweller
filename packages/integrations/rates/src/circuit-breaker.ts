import type { Redis } from 'ioredis';
import type { RatesPort, PurityRates } from './port';
import { CircuitOpenError, RatesAdapterError } from './errors';

const FAILURE_THRESHOLD = 5;
const FAILURE_WINDOW_SEC = 60;
const COOLDOWN_SEC = 120;

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker implements RatesPort {
  private readonly keyState: string;
  private readonly keyFailures: string;
  private readonly keyOpenedAt: string;

  constructor(
    private readonly adapter: RatesPort,
    private readonly redis: Redis,
  ) {
    const name = adapter.getName();
    this.keyState = `cb:${name}:state`;
    this.keyFailures = `cb:${name}:failures`;
    this.keyOpenedAt = `cb:${name}:opened_at`;
  }

  getName(): string {
    return this.adapter.getName();
  }

  private async getState(): Promise<CircuitState> {
    const raw = await this.redis.get(this.keyState);
    if (raw === 'OPEN' || raw === 'HALF_OPEN') return raw;
    return 'CLOSED';
  }

  private async setState(state: CircuitState): Promise<void> {
    await this.redis.set(this.keyState, state);
  }

  private async resetFailures(): Promise<void> {
    await this.redis.del(this.keyFailures);
    await this.redis.del(this.keyOpenedAt);
  }

  private async recordFailure(): Promise<void> {
    const count = await this.redis.incr(this.keyFailures);
    if (count === 1) {
      // First failure in this window — set TTL
      await this.redis.expire(this.keyFailures, FAILURE_WINDOW_SEC);
    }
    if (count >= FAILURE_THRESHOLD) {
      const alreadyOpen = await this.redis.get(this.keyState);
      if (alreadyOpen !== 'OPEN') {
        await this.setState('OPEN');
        await this.redis.set(this.keyOpenedAt, String(Date.now()));
      }
    }
  }

  private async checkCooldownElapsed(): Promise<boolean> {
    const openedAt = await this.redis.get(this.keyOpenedAt);
    if (!openedAt) return true;
    const elapsed = (Date.now() - Number(openedAt)) / 1000;
    return elapsed >= COOLDOWN_SEC;
  }

  async getRatesByPurity(): Promise<PurityRates> {
    const state = await this.getState();

    if (state === 'OPEN') {
      const elapsed = await this.checkCooldownElapsed();
      if (elapsed) {
        await this.setState('HALF_OPEN');
        return this.probe();
      }
      throw new CircuitOpenError(this.adapter.getName());
    }

    if (state === 'HALF_OPEN') {
      return this.probe();
    }

    // CLOSED
    return this.callAdapter();
  }

  private async probe(): Promise<PurityRates> {
    try {
      const rates = await this.adapter.getRatesByPurity();
      // Success → CLOSED
      await this.setState('CLOSED');
      await this.resetFailures();
      return rates;
    } catch (err) {
      // Failure → back to OPEN
      await this.setState('OPEN');
      await this.redis.set(this.keyOpenedAt, String(Date.now()));
      if (err instanceof RatesAdapterError) throw err;
      throw new RatesAdapterError(this.adapter.getName(), err);
    }
  }

  private async callAdapter(): Promise<PurityRates> {
    try {
      const rates = await this.adapter.getRatesByPurity();
      // Success in CLOSED — reset failures
      await this.redis.del(this.keyFailures);
      return rates;
    } catch (err) {
      await this.recordFailure();
      if (err instanceof RatesAdapterError) throw err;
      throw new RatesAdapterError(this.adapter.getName(), err);
    }
  }
}
