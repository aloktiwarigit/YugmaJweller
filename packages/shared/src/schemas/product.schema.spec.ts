import { describe, it, expect } from 'vitest';
import { CreateProductSchema, UpdateTryOnAssetSchema } from './product.schema';

const BASE = {
  sku: 'RING-1', metal: 'GOLD', purity: '22K',
  grossWeightG: '5.0000', netWeightG: '4.5000',
  stoneWeightG: '0.1000',
} as const;

describe('CreateProductSchema try-on fields', () => {
  it('accepts optional mm dimensions and a try-on body part', () => {
    const parsed = CreateProductSchema.parse({
      ...BASE,
      tryOnLengthMm: '24.50', tryOnBodyPart: 'FINGER',
    });
    expect(parsed.tryOnLengthMm).toBe('24.50');
    expect(parsed.tryOnBodyPart).toBe('FINGER');
  });

  it('rejects an invalid body part', () => {
    expect(() =>
      CreateProductSchema.parse({
        ...BASE,
        tryOnBodyPart: 'FOOT',
      }),
    ).toThrow();
  });

  it('omits try-on fields cleanly when not provided', () => {
    const parsed = CreateProductSchema.parse({ ...BASE });
    expect(parsed.tryOnLengthMm).toBeUndefined();
  });
});

describe('UpdateTryOnAssetSchema', () => {
  it('accepts normalized anchors and an enabled flag', () => {
    const parsed = UpdateTryOnAssetSchema.parse({ anchorX: 0.5, anchorY: 0.0, enabled: true });
    expect(parsed.anchorX).toBe(0.5);
    expect(parsed.enabled).toBe(true);
  });

  it('rejects an anchor outside 0..1', () => {
    expect(() => UpdateTryOnAssetSchema.parse({ anchorX: 1.4, anchorY: 0, enabled: false })).toThrow();
  });

  it('requires the enabled flag', () => {
    expect(() => UpdateTryOnAssetSchema.parse({ anchorX: 0.5, anchorY: 0.5 })).toThrow();
  });
});
