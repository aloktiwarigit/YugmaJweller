import { describe, it, expect } from 'vitest';
import { decomposePose } from './pose';

const IDENTITY = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

function rotZ(deg: number): number[] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];
}

describe('decomposePose', () => {
  it('returns ~zero angles for identity', () => {
    const p = decomposePose(IDENTITY);
    expect(p.rollRad).toBeCloseTo(0, 5);
    expect(p.pitchRad).toBeCloseTo(0, 5);
    expect(p.yawRad).toBeCloseTo(0, 5);
  });

  it('extracts roll from a Z rotation', () => {
    const p = decomposePose(rotZ(30));
    expect((p.rollRad * 180) / Math.PI).toBeCloseTo(30, 1);
  });

  it('throws on a non-16-length matrix', () => {
    expect(() => decomposePose([1, 2, 3])).toThrow();
  });
});
