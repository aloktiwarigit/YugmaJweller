import { describe, expect, it } from 'vitest';
import { demoShopCampaignImageUris } from './demoShopCampaignImageData';
import { demoShopImageUris } from './demoShopImageData';
import { demoShopImageUriForPath } from './demoShopImageResolver';
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

  it('resolves exact demo product assets before category fallback', () => {
    expect(demoShopImageUriForPath('/demo-shop/ring-diamond.jpg')).toBe(
      demoShopImageUris['ring-diamond.jpg'],
    );
  });

  it('resolves exact campaign assets for mobile hero imagery', () => {
    expect(demoShopImageUriForPath('/demo-shop/campaign-necklace-showcase.jpg')).toBe(
      demoShopCampaignImageUris['campaign-necklace-showcase.jpg'],
    );
  });
});
