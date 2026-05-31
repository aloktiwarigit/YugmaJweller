import { describe, it, expect } from 'vitest';
import { OneEuroFilter } from './one-euro-filter';

describe('OneEuroFilter', () => {
  it('returns the first sample unchanged', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.0, dCutoff: 1.0 });
    expect(f.filter(10, 0)).toBeCloseTo(10, 5);
  });

  it('smooths a noisy-but-stationary signal toward its mean', () => {
    const f = new OneEuroFilter({ minCutoff: 0.5, beta: 0.0, dCutoff: 1.0 });
    const noisy = [100, 102, 98, 101, 99, 100.5, 99.5];
    let out = 0;
    noisy.forEach((v, i) => { out = f.filter(v, i / 30); });
    expect(out).toBeGreaterThan(99);
    expect(out).toBeLessThan(101);
  });

  it('tracks a fast ramp without large lag (adaptive cutoff)', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.5, dCutoff: 1.0 });
    let out = 0;
    for (let i = 0; i < 10; i++) out = f.filter(i * 10, i / 30);
    expect(out).toBeGreaterThan(80);
  });
});
