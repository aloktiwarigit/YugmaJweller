import { describe, it, expect } from 'vitest';
import { resolveAssetWidthNorm, estimateDiameterMmFromWeight } from './size';

describe('resolveAssetWidthNorm', () => {
  it('uses real mm dimension when present (true-to-size)', () => {
    const r = resolveAssetWidthNorm(
      { dimensions: { widthMm: 20 }, metal: 'GOLD', purity: '22K', netWeightG: 5 },
      0.003,
      'EAR',
    );
    expect(r.widthNorm).toBeCloseTo(0.06, 6);
    expect(r.trueToSize).toBe(true);
  });

  it('falls back to a weight estimate and flags it not-true-to-size', () => {
    const r = resolveAssetWidthNorm(
      { dimensions: {}, metal: 'GOLD', purity: '22K', netWeightG: 5 },
      0.003,
      'FINGER',
    );
    expect(r.trueToSize).toBe(false);
    expect(r.widthNorm).toBeGreaterThan(0);
  });

  it('prefers diameterMm for FINGER/WRIST', () => {
    const r = resolveAssetWidthNorm(
      { dimensions: { diameterMm: 18 }, metal: 'GOLD', purity: '22K', netWeightG: 4 },
      0.003,
      'FINGER',
    );
    expect(r.widthNorm).toBeCloseTo(18 * 0.003, 6);
    expect(r.trueToSize).toBe(true);
  });
});

describe('estimateDiameterMmFromWeight', () => {
  it('returns a positive coarse estimate scaled by metal density', () => {
    const d22 = estimateDiameterMmFromWeight(5, 'GOLD', '22K');
    const d24 = estimateDiameterMmFromWeight(5, 'GOLD', '24K');
    expect(d22).toBeGreaterThan(0);
    expect(d24).toBeLessThan(d22);
  });
});
