import { describe, it, expect } from 'vitest';
import { BODY_PARTS, mmFieldForBodyPart, presetsForBodyPart, clampAnchor } from './tryOnPresets';

describe('tryOnPresets', () => {
  it('lists all four body parts in face-then-hand order', () => {
    expect(BODY_PARTS).toEqual(['EAR', 'NECK', 'FINGER', 'WRIST']);
  });

  it('maps EAR/NECK to lengthMm and FINGER/WRIST to diameterMm', () => {
    expect(mmFieldForBodyPart('EAR')).toBe('tryOnLengthMm');
    expect(mmFieldForBodyPart('NECK')).toBe('tryOnLengthMm');
    expect(mmFieldForBodyPart('FINGER')).toBe('tryOnDiameterMm');
    expect(mmFieldForBodyPart('WRIST')).toBe('tryOnDiameterMm');
  });

  it('gives three ascending presets per body part', () => {
    const ring = presetsForBodyPart('FINGER');
    expect(ring).toHaveLength(3);
    expect(ring[0]!.mm).toBeLessThan(ring[2]!.mm);
  });

  it('clampAnchor keeps values inside [0,1]', () => {
    expect(clampAnchor(-0.2)).toBe(0);
    expect(clampAnchor(1.7)).toBe(1);
    expect(clampAnchor(0.42)).toBeCloseTo(0.42, 5);
  });
});
