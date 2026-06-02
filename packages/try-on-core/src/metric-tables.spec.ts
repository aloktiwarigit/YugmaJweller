import { describe, it, expect } from 'vitest';
import {
  RING_DIAMETER_MM,
  BANGLE_DIAMETER_MM,
  ringDiameterForIndianSize,
  nearestBangleSize,
} from './metric-tables';

describe('ring tables', () => {
  it('has Indian sizes 1..20', () => {
    expect(RING_DIAMETER_MM[1]).toBeCloseTo(12.1, 2);
    expect(RING_DIAMETER_MM[20]).toBeCloseTo(20.2, 2);
  });
  it('looks up diameter by Indian ring size', () => {
    expect(ringDiameterForIndianSize(10)).toBeCloseTo(16.0, 2);
  });
});

describe('bangle tables', () => {
  it('maps standard labels to inner diameters (mm)', () => {
    expect(BANGLE_DIAMETER_MM['M']).toBe(58);
  });
  it('finds the nearest bangle size for a measured wrist diameter', () => {
    expect(nearestBangleSize(57)).toBe('S');
  });
});
