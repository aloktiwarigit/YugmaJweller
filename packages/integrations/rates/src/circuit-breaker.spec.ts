import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { CircuitBreaker } from './circuit-breaker';
import { CircuitOpenError, RatesAdapterError } from './errors';
import type { RatesPort, PurityRates } from './port';

const STUB_RATES: PurityRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: new Date() },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: new Date() },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: new Date() },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: new Date() },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: new Date() },
  SILVER_999: { perGramPaise: 9500n, fetchedAt: new Date() },
  SILVER_925: { perGramPaise: 8788n, fetchedAt: new Date() },
};

function makeAdapter(name: string, impl: () => Promise<PurityRates>): RatesPort {
  return { getName: () => name, getRatesByPurity: impl };
}

describe('CircuitBreaker', () => {
  let redis: Redis;
  let successAdapter: RatesPort;
  let failAdapter: RatesPort;

  beforeEach(() => {
    redis = new RedisMock() as unknown as Redis;
    successAdapter = makeAdapter('test', async () => STUB_RATES);
    failAdapter = makeAdapter('test', async () => {
      throw new RatesAdapterError('test', new Error('network error'));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in CLOSED state', async () => {
    const cb = new CircuitBreaker(successAdapter, redis);
    const rates = await cb.getRatesByPurity();
    expect(rates.GOLD_24K.perGramPaise).toBe(735000n);
  });

  it('CLOSED→OPEN after 5 consecutive failures within 60s', async () => {
    const cb = new CircuitBreaker(failAdapter, redis);

    // First 5 calls should throw RatesAdapterError (pass-through)
    for (let i = 0; i < 5; i++) {
      await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
    }

    // 6th call: circuit is OPEN → CircuitOpenError
    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('OPEN state rejects with CircuitOpenError without calling fn', async () => {
    const cb = new CircuitBreaker(failAdapter, redis);

    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
    }

    const spy = vi.spyOn(failAdapter, 'getRatesByPurity');
    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);
    expect(spy).not.toHaveBeenCalled();
  });

  it('OPEN→HALF_OPEN after 120s cooldown', async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker(failAdapter, redis);

    // Trip the circuit
    for (let i = 0; i < 5; i++) {
      await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
    }

    // Verify OPEN
    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);

    // Advance time by 120s
    await vi.advanceTimersByTimeAsync(120_000);

    // Now swap to success adapter — next call should be a HALF_OPEN probe
    const probeCb = new CircuitBreaker(successAdapter, redis);
    // The state is shared via Redis so we need to use same redis instance
    // But CircuitBreaker is constructed with different adapter.
    // We can test by checking the cb allows the probe through after time passes.
    // Re-wrap to use same redis + successful adapter after time advance:
    const healedCb = new CircuitBreaker(successAdapter, redis);
    const rates = await healedCb.getRatesByPurity();
    expect(rates.GOLD_24K.perGramPaise).toBe(735000n);
  });

  it('HALF_OPEN: successful probe → returns to CLOSED', async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker(failAdapter, redis);

    for (let i = 0; i < 5; i++) {
      await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
    }

    await vi.advanceTimersByTimeAsync(120_000);

    // Use success adapter wrapping same redis state — probe succeeds → CLOSED
    const healedCb = new CircuitBreaker(successAdapter, redis);
    await healedCb.getRatesByPurity(); // probe (HALF_OPEN → CLOSED)
    await healedCb.getRatesByPurity(); // normal CLOSED call — should not throw
  });

  it('HALF_OPEN: failed probe → returns to OPEN', async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker(failAdapter, redis);

    for (let i = 0; i < 5; i++) {
      await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
    }

    await vi.advanceTimersByTimeAsync(120_000);

    // Still failing adapter — probe fails → back to OPEN
    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
    // Next call should be CircuitOpenError again
    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('concurrent spike: multiple simultaneous failures don\'t double-open', async () => {
    const cb = new CircuitBreaker(failAdapter, redis);

    // Fire 10 concurrent requests; circuit should only open once
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => cb.getRatesByPurity()),
    );

    const adapterErrors = results.filter(
      r => r.status === 'rejected' && r.reason instanceof RatesAdapterError,
    );
    const circuitErrors = results.filter(
      r => r.status === 'rejected' && r.reason instanceof CircuitOpenError,
    );

    // At least 5 should be adapter errors (before trip), rest circuit errors
    expect(adapterErrors.length).toBeGreaterThanOrEqual(5);
    expect(circuitErrors.length).toBeGreaterThanOrEqual(1);
    expect(adapterErrors.length + circuitErrors.length).toBe(10);
  });
});
