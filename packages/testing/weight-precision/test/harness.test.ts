import { describe, it, expect } from 'vitest';
import { runWeightPrecisionHarness } from '../src/harness';

describe('weight-precision harness', () => {
  it('runs 10,000 random price computations with zero paise-level failures', async () => {
    const result = await runWeightPrecisionHarness();

    expect(result.total).toBe(10_000);

    if (result.failed > 0) {
      const sample = result.failures.slice(0, 3);
      const detail = sample
        .map(f => `input=${JSON.stringify(f.input, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))} expected=${f.expected} actual=${f.actual}`)
        .join('\n');
      throw new Error(`${result.failed} paise-level mismatches (showing up to 3):\n${detail}`);
    }

    expect(result.failed).toBe(0);
  }, 30_000);  // 30s timeout for 10k iterations
});
