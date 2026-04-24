import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from '@goldsmith/cache';
import { CircuitBreaker } from './circuit-breaker';
import { CircuitOpenError, RatesAdapterError } from './errors';
import type { RatesPort, PurityRates, RatesResult } from './port';

const STUB_RATES: PurityRates = {
  GOLD_24K: { perGramPaise: 735000n, fetchedAt: new Date() },
  GOLD_22K: { perGramPaise: 673750n, fetchedAt: new Date() },
  GOLD_20K: { perGramPaise: 612500n, fetchedAt: new Date() },
  GOLD_18K: { perGramPaise: 551250n, fetchedAt: new Date() },
  GOLD_14K: { perGramPaise: 428750n, fetchedAt: new Date() },
  SILVER_999: { perGramPaise: 9500n, fetchedAt: new Date() },
  SILVER_925: { perGramPaise: 8788n, fetchedAt: new Date() },
};

const STUB_RESULT: RatesResult = { rates: STUB_RATES, source: 'test', stale: false };

function makeAdapter(name: string, impl: () => Promise<RatesResult>): RatesPort {
  return { getName: () => name, getRatesByPurity: impl };
}

/** Helper: trip the circuit by calling the CB with a failing adapter 5 times sequentially. */
async function tripCircuit(cb: CircuitBreaker): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await cb.getRatesByPurity().catch(() => {
      /* expected */
    });
  }
}

/** Helper: directly set the opened_at key in Redis to a time 200s in the past so cooldown has elapsed. */
async function backdateOpenedAt(redis: Redis, adapterName: string): Promise<void> {
  const pastTs = Date.now() - 200_000;
  await redis.set(`cb:${adapterName}:opened_at`, String(pastTs));
}

describe('CircuitBreaker', () => {
  let redis: Redis;
  let successAdapter: RatesPort;
  let failAdapter: RatesPort;

  beforeEach(async () => {
    redis = new RedisMock() as unknown as Redis;
    // ioredis-mock shares context across instances with the same host:port/db.
    // Flush the shared store before each test to ensure clean state.
    await redis.flushall();
    successAdapter = makeAdapter('test', async () => STUB_RESULT);
    failAdapter = makeAdapter('test', async () => {
      throw new RatesAdapterError('test', new Error('network error'));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in CLOSED state', async () => {
    const cb = new CircuitBreaker(successAdapter, redis);
    const result = await cb.getRatesByPurity();
    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
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
    const cb = new CircuitBreaker(failAdapter, redis);

    // Trip the circuit
    await tripCircuit(cb);

    // Verify OPEN
    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);

    // Backdate opened_at to simulate 200s elapsed (> 120s cooldown)
    await backdateOpenedAt(redis, 'test');

    // After cooldown, a HALF_OPEN probe with success adapter should succeed
    const healedCb = new CircuitBreaker(successAdapter, redis);
    const result = await healedCb.getRatesByPurity();
    expect(result.rates.GOLD_24K.perGramPaise).toBe(735000n);
  });

  it('HALF_OPEN: successful probe → returns to CLOSED', async () => {
    const cb = new CircuitBreaker(failAdapter, redis);
    await tripCircuit(cb);

    // Backdate to get past cooldown
    await backdateOpenedAt(redis, 'test');

    // Use success adapter — probe succeeds → CLOSED
    const healedCb = new CircuitBreaker(successAdapter, redis);
    await healedCb.getRatesByPurity(); // probe (OPEN → HALF_OPEN probe → CLOSED)
    // Another call: should be normal CLOSED (not a probe)
    await healedCb.getRatesByPurity();
  });

  it('HALF_OPEN: failed probe → returns to OPEN', async () => {
    const cb = new CircuitBreaker(failAdapter, redis);
    await tripCircuit(cb);

    // Backdate to get past cooldown
    await backdateOpenedAt(redis, 'test');

    // Still failing adapter — probe fails → back to OPEN
    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(RatesAdapterError);
    // Next call should be CircuitOpenError again (circuit is OPEN again, opened_at reset to now)
    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("concurrent spike: multiple simultaneous failures don't double-open", async () => {
    const cb = new CircuitBreaker(failAdapter, redis);

    // Fire 10 concurrent requests; circuit opens during this batch.
    // In JS, since getState() checks are interleaved before any failures are recorded,
    // all 10 calls pass through to the adapter. After the 5th failure is recorded,
    // the circuit opens. All 10 calls eventually throw RatesAdapterError (they already
    // past the state check). But the circuit MUST be in OPEN state afterwards.
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => cb.getRatesByPurity()),
    );

    // All rejections must be either RatesAdapterError or CircuitOpenError
    const failures = results.filter(r => r.status === 'rejected');
    expect(failures).toHaveLength(10);

    const unknownErrors = failures.filter(
      r =>
        r.status === 'rejected' &&
        !(r.reason instanceof RatesAdapterError) &&
        !(r.reason instanceof CircuitOpenError),
    );
    expect(unknownErrors).toHaveLength(0);

    // After the concurrent spike, the circuit must be OPEN (not double-opened or in bad state)
    await expect(cb.getRatesByPurity()).rejects.toBeInstanceOf(CircuitOpenError);
  });
});
