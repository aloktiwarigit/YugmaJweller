import { describe, it, expect } from 'vitest';
import { runWeightPrecisionHarness, runInvoiceWeightPrecisionHarness } from '../src/harness';

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

describe('runInvoiceWeightPrecisionHarness', () => {
  it('matches Decimal.js golden across 10,000 multi-line invoices (zero failures tolerated)', async () => {
    const out = await runInvoiceWeightPrecisionHarness();

    if (out.failed > 0) {
      const sample = out.failures.slice(0, 3);
      const detail = sample
        .map(f => `first_line=${JSON.stringify(f.input, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))} expected=${f.expected} actual=${f.actual}`)
        .join('\n');
      throw new Error(`${out.failed} invoice paise-level mismatches (showing up to 3 first-line samples):\n${detail}`);
    }

    expect(out.failed).toBe(0);
    expect(out.passed).toBe(10_000);
  }, 60_000);  // 60s timeout for 10k multi-line invoices
});
