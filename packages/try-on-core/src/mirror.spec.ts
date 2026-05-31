import { describe, it, expect } from 'vitest';
import { resolveEarSide, mirrorXIfNeeded } from './mirror';

describe('mirrorXIfNeeded', () => {
  it('flips x around 0.5 when the feed is mirrored', () => {
    expect(mirrorXIfNeeded(0.3, true)).toBeCloseTo(0.7, 6);
  });
  it('leaves x unchanged when not mirrored', () => {
    expect(mirrorXIfNeeded(0.3, false)).toBeCloseTo(0.3, 6);
  });
});

describe('resolveEarSide', () => {
  it('swaps left/right when the front camera is mirrored', () => {
    expect(resolveEarSide('left', true)).toBe('right');
    expect(resolveEarSide('left', false)).toBe('left');
  });
});
