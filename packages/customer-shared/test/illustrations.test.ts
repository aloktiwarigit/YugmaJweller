import { describe, it, expect } from 'vitest';
import {
  categoryToFallbackSvg,
  RING_SVG, EARRING_SVG, PENDANT_SVG,
  BANGLE_SVG, NECKLACE_SVG, SILVER_SVG,
} from '../src/illustrations';

describe('SVG constants', () => {
  for (const [name, svg] of [
    ['RING_SVG', RING_SVG], ['EARRING_SVG', EARRING_SVG],
    ['PENDANT_SVG', PENDANT_SVG], ['BANGLE_SVG', BANGLE_SVG],
    ['NECKLACE_SVG', NECKLACE_SVG], ['SILVER_SVG', SILVER_SVG],
  ] as const) {
    it(`${name} is valid SVG with cream background`, () => {
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox="0 0 160 200"');
      expect(svg).toContain('width="160"');
      expect(svg).toContain('height="200"');
      expect(svg).toContain('#F5EDDD');
      expect(svg).toContain('#B58A3C');
      expect(svg).toContain('fill="none"');
      expect(svg).toContain('stroke-width="2"');
      expect(svg).not.toContain('Goldsmith');
    });
  }
});

describe('categoryToFallbackSvg', () => {
  it('returns RING_SVG for "rings"', () => {
    expect(categoryToFallbackSvg('rings')).toBe(RING_SVG);
  });

  it('returns RING_SVG for "Ring" (case-insensitive)', () => {
    expect(categoryToFallbackSvg('Ring')).toBe(RING_SVG);
  });

  it('returns EARRING_SVG for "earrings"', () => {
    expect(categoryToFallbackSvg('earrings')).toBe(EARRING_SVG);
  });

  it('returns PENDANT_SVG for "pendants"', () => {
    expect(categoryToFallbackSvg('pendants')).toBe(PENDANT_SVG);
  });

  it('returns BANGLE_SVG for "bangles"', () => {
    expect(categoryToFallbackSvg('bangles')).toBe(BANGLE_SVG);
  });

  it('returns NECKLACE_SVG for "necklaces"', () => {
    expect(categoryToFallbackSvg('necklaces')).toBe(NECKLACE_SVG);
  });

  it('returns SILVER_SVG for "silver"', () => {
    expect(categoryToFallbackSvg('silver')).toBe(SILVER_SVG);
  });

  it('falls back to SILVER_SVG for unknown category', () => {
    expect(categoryToFallbackSvg('unknown-category')).toBe(SILVER_SVG);
  });

  it('falls back to SILVER_SVG for null / undefined / empty input', () => {
    expect(categoryToFallbackSvg(null)).toBe(SILVER_SVG);
    expect(categoryToFallbackSvg(undefined)).toBe(SILVER_SVG);
    expect(categoryToFallbackSvg('')).toBe(SILVER_SVG);
  });

  it('returns RING_SVG for Hindi "अंगूठी"', () => {
    expect(categoryToFallbackSvg('सोने की अंगूठी')).toBe(RING_SVG);
  });

  it('returns BANGLE_SVG for Hindi "चूड़ियाँ"', () => {
    expect(categoryToFallbackSvg('सोने की चूड़ियाँ')).toBe(BANGLE_SVG);
  });

  it('returns SILVER_SVG for Hindi "चाँदी"', () => {
    expect(categoryToFallbackSvg('चाँदी के आभूषण')).toBe(SILVER_SVG);
  });
});
