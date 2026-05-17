import type { Redis } from '@goldsmith/cache';
import type { RatesPort, RatesResult } from './port';
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
    // Best-effort. Redis being out of quota or unreachable must NEVER mask the
    // adapter's own error or fail the request. If we can't track state,
    // worst case is a few extra adapter calls — much better than dropping
    // every rate request when Redis is down.
    try {
      if (state === 'OPEN') {
        await this.redis.set(this.keyState, state, 'EX', COOLDOWN_SEC * 4);
      } else if (state === 'HALF_OPEN') {
        await this.redis.set(this.keyState, state, 'EX', COOLDOWN_SEC);
      } else {
        await this.redis.del(this.keyState);
      }
    } catch { /* Redis unavailable — assume CLOSED on next call */ }
  }

  private async resetFailures(): Promise<void> {
    try {
      await this.redis.del(this.keyFailures);
      await this.redis.del(this.keyOpenedAt);
    } catch { /* best-effort */ }
  }

  private async recordFailure(): Promise<void> {
    // Best-effort. See setState() comment.
    try {
      const count = await this.redis.incr(this.keyFailures);
      if (count === 1) {
        await this.redis.expire(this.keyFailures, FAILURE_WINDOW_SEC);
      }
      if (count >= FAILURE_THRESHOLD) {
        const alreadyOpen = await this.redis.get(this.keyState);
        if (alreadyOpen !== 'OPEN') {
          await this.redis.set(this.keyOpenedAt, String(Date.now()), 'EX', COOLDOWN_SEC * 4 + FAILURE_WINDOW_SEC);
          await this.setState('OPEN');
        }
      }
    } catch { /* Redis unavailable — skip CB bookkeeping this call */ }
  }

  private async checkCooldownElapsed(): Promise<boolean> {
    try {
      const openedAt = await this.redis.get(this.keyOpenedAt);
      if (!openedAt) return true;
      const elapsed = (Date.now() - Number(openedAt)) / 1000;
      return elapsed >= COOLDOWN_SEC;
    } catch { return true; /* Redis down — let the call through */ }
  }

  async getRatesByPurity(): Promise<RatesResult> {
    // Default to CLOSED when Redis is unavailable — let the adapter attempt proceed
    let state: CircuitState = 'CLOSED';
    try {
      state = await this.getState();
    } catch {
      // Redis down — assume CLOSED and call through; adapter failure will be recorded normally
    }

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

  private async probe(): Promise<RatesResult> {
    try {
      const result = await this.adapter.getRatesByPurity();
      await this.setState('CLOSED');
      await this.resetFailures();
      return result;
    } catch (err) {
      await this.setState('OPEN');
      try {
        await this.redis.set(this.keyOpenedAt, String(Date.now()), 'EX', COOLDOWN_SEC * 4 + FAILURE_WINDOW_SEC);
      } catch { /* best-effort */ }
      if (err instanceof RatesAdapterError) throw err;
      throw new RatesAdapterError(this.adapter.getName(), err);
    }
  }

  private async callAdapter(): Promise<RatesResult> {
    try {
      const result = await this.adapter.getRatesByPurity();
      // Success — reset failures counter (best-effort; Redis failure must not mask adapter success)
      this.redis.del(this.keyFailures).catch(() => {});
      return result;
    } catch (err) {
      await this.recordFailure();
      if (err instanceof RatesAdapterError) throw err;
      throw new RatesAdapterError(this.adapter.getName(), err);
    }
  }
}
