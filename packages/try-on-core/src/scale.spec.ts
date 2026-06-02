import { describe, it, expect } from 'vitest';
import { normPerMmFace, normPerMmHand, DEFAULT_IPD_MM } from './scale';
import type { Landmark } from './types';

const L = (x: number, y: number, z = 0): Landmark => ({ x, y, z });

describe('normPerMmFace', () => {
  it('derives normalized-units-per-mm from the iris-centre distance and IPD', () => {
    const leftIris = L(0.4, 0.5);
    const rightIris = L(0.6, 0.5);
    const npm = normPerMmFace(leftIris, rightIris, DEFAULT_IPD_MM);
    expect(npm).toBeCloseTo(0.2 / 63, 6);
  });

  it('uses a custom IPD when provided (calibration)', () => {
    const npm = normPerMmFace(L(0.4, 0.5), L(0.6, 0.5), 70);
    expect(npm).toBeCloseTo(0.2 / 70, 6);
  });

  it('accounts for vertical separation (euclidean, not just dx)', () => {
    const npm = normPerMmFace(L(0.4, 0.5), L(0.6, 0.6), 63);
    const dist = Math.hypot(0.2, 0.1);
    expect(npm).toBeCloseTo(dist / 63, 6);
  });
});

describe('normPerMmHand', () => {
  it('derives scale from finger-segment width and an assumed finger width', () => {
    const npm = normPerMmHand(L(0.5, 0.5), L(0.55, 0.5), 9);
    expect(npm).toBeCloseTo(0.05 / 9, 6);
  });
});
