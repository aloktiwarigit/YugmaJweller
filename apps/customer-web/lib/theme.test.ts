import { describe, it, expect } from 'vitest';
import { wcagContrastRatio, buildThemeStyle } from './theme';

describe('wcagContrastRatio', () => {
  it('ink on cream is ≥ 12 (AAA)', () => {
    expect(wcagContrastRatio('#1E2440', '#F5EDDD')).toBeGreaterThanOrEqual(12);
  });

  it('primaryDeep (#896024) on cream is ≥ 4.5 (AA)', () => {
    // #8C6628 from plan was 4.46:1 — corrected to #896024 which gives 4.8:1
    expect(wcagContrastRatio('#896024', '#F5EDDD')).toBeGreaterThanOrEqual(4.5);
  });

  it('primary (#B58A3C) on cream fails AA (< 4.5)', () => {
    expect(wcagContrastRatio('#B58A3C', '#F5EDDD')).toBeLessThan(4.5);
  });

  it('white on ink is high contrast', () => {
    expect(wcagContrastRatio('#FFFFFF', '#1E2440')).toBeGreaterThan(10);
  });

  it('is symmetric', () => {
    const a = wcagContrastRatio('#B58A3C', '#F5EDDD');
    const b = wcagContrastRatio('#F5EDDD', '#B58A3C');
    expect(a).toBeCloseTo(b, 5);
  });
});

describe('buildThemeStyle contrast guard', () => {
  it('white-on-primaryDeep → primaryFg stays white (passes AA)', () => {
    const style = buildThemeStyle('#896024');
    expect(style['--color-primary-fg' as string]).toBe('#FFFFFF');
  });

  it('bright yellow primary → primaryFg falls back to ink', () => {
    // #FFFF00 has near-zero contrast against white
    const style = buildThemeStyle('#FFFF00');
    expect(style['--color-primary-fg' as string]).toBe('#1E2440');
  });

  it('dark primary → on-primary stays as primary color (readable on cream)', () => {
    const style = buildThemeStyle('#1E2440');
    expect(style['--color-on-primary' as string]).toBe('#1E2440');
  });

  it('light primary that fails AA on cream → on-primary falls to ink', () => {
    // very light color: #F0E8D8 is near-cream, 1.1:1 on cream
    const style = buildThemeStyle('#F0E8D8');
    expect(style['--color-on-primary' as string]).toBe('#1E2440');
  });
});
