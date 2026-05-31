import { describe, it, expect } from 'vitest';
import { anchorFor, FACE_INDEX, HAND_INDEX } from './anchor';
import type { Landmark } from './types';

function faceLandmarks(overrides: Record<number, [number, number]>): Landmark[] {
  const arr: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, [x, y]] of Object.entries(overrides)) arr[Number(i)] = { x, y, z: 0 };
  return arr;
}

function handLandmarks(overrides: Record<number, [number, number]>): Landmark[] {
  const arr: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, [x, y]] of Object.entries(overrides)) arr[Number(i)] = { x, y, z: 0 };
  return arr;
}

describe('anchorFor EAR', () => {
  it('places the earring below the ear-region landmark by a fraction of face height', () => {
    const lm = faceLandmarks({
      [FACE_INDEX.chin]: [0.5, 0.9],
      [FACE_INDEX.foreheadTop]: [0.5, 0.1],
      [FACE_INDEX.leftEar]: [0.35, 0.5],
    });
    const a = anchorFor('EAR', lm, { side: 'left' });
    expect(a.x).toBeCloseTo(0.35, 3);
    expect(a.y).toBeGreaterThan(0.5);
  });
});

describe('anchorFor NECK', () => {
  it('projects below the chin toward the sternal notch', () => {
    const lm = faceLandmarks({
      [FACE_INDEX.chin]: [0.5, 0.8],
      [FACE_INDEX.foreheadTop]: [0.5, 0.2],
    });
    const a = anchorFor('NECK', lm, {});
    expect(a.x).toBeCloseTo(0.5, 3);
    expect(a.y).toBeGreaterThan(0.8);
  });
});

describe('anchorFor FINGER', () => {
  it('is the midpoint of the ring-finger base and PIP joints', () => {
    const lm = handLandmarks({
      [HAND_INDEX.ringMcp]: [0.40, 0.50],
      [HAND_INDEX.ringPip]: [0.50, 0.40],
    });
    const a = anchorFor('FINGER', lm, {});
    expect(a.x).toBeCloseTo(0.45, 3);
    expect(a.y).toBeCloseTo(0.45, 3);
  });
});

describe('anchorFor WRIST', () => {
  it('is the wrist landmark', () => {
    const lm = handLandmarks({ [HAND_INDEX.wrist]: [0.5, 0.7] });
    const a = anchorFor('WRIST', lm, {});
    expect(a.x).toBeCloseTo(0.5, 3);
    expect(a.y).toBeCloseTo(0.7, 3);
  });
});
