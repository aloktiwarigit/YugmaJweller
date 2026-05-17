import { describe, expect, it } from 'vitest';
import { imageForCategoryName, storefrontFallbackImage } from './storefrontImages';

describe('storefront image mapping', () => {
  it('maps known category names to aspirational image sources', () => {
    expect(imageForCategoryName('Rings')).not.toBe(storefrontFallbackImage);
    expect(imageForCategoryName('सोने की अंगूठी')).not.toBe(storefrontFallbackImage);
    expect(imageForCategoryName('Necklaces')).not.toBe(storefrontFallbackImage);
  });

  it('falls back for missing category names', () => {
    expect(imageForCategoryName(null)).toBe(storefrontFallbackImage);
  });
});
