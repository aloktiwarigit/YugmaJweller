import { describe, it, expect } from 'vitest';
import {
  StorefrontConfigSchema,
  HeroBannerSchema,
  STOREFRONT_CONFIG_DEFAULTS,
} from './storefront-config.schema';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('StorefrontConfigSchema', () => {
  it('T5: empty object applies all defaults', () => {
    const result = StorefrontConfigSchema.parse({});
    expect(result.heroBanners).toEqual([]);
    expect(result.featuredCollectionIds).toEqual([]);
    expect(result.premiumCollectionIds).toEqual([]);
    expect(result.giftPersonaOverrides).toEqual([]);
    expect(result.brandPalette).toEqual({});
    expect(result.trustPillarsOverride).toEqual([]);
  });

  it('T2: round-trips a full config through Zod with no data loss', () => {
    const config = {
      heroBanners: [{
        imageId: VALID_UUID,
        imageUrl: '/demo-shop/hero-rings.jpg',
        headlineHi: 'आभूषण संग्रह',
        headlineEn: 'Jewellery Collection',
        ctaUrl: '/products',
        validFrom: '2026-01-01T00:00:00.000Z',
      }],
      featuredCollectionIds: [VALID_UUID],
      premiumCollectionIds: [],
      giftPersonaOverrides: [{ persona: 'Mother', href: '/gift/mother', label: 'माँ के लिए' }],
      brandPalette: { accentMode: 'warm' as const, heroPattern: 'lotus' as const },
      trustPillarsOverride: [{ titleHi: 'हॉलमार्क', titleEn: 'BIS Hallmark', descriptionHi: 'प्रमाणित सोना' }],
    };
    const result = StorefrontConfigSchema.parse(config);
    expect(result.heroBanners[0]!.headlineHi).toBe('आभूषण संग्रह');
    expect(result.heroBanners[0]!.imageUrl).toBe('/demo-shop/hero-rings.jpg');
    expect(result.heroBanners[0]!.ctaUrl).toBe('/products');
    expect(result.brandPalette.accentMode).toBe('warm');
    expect(result.brandPalette.heroPattern).toBe('lotus');
    expect(result.premiumCollectionIds).toEqual([]);
    expect(result.giftPersonaOverrides[0]!.label).toBe('माँ के लिए');
    expect(result.trustPillarsOverride[0]!.titleEn).toBe('BIS Hallmark');
  });

  it('T3: rejects ctaUrl that is not an internal route', () => {
    expect(() =>
      HeroBannerSchema.parse({
        imageId: VALID_UUID,
        headlineHi: 'Test',
        ctaUrl: 'https://example.com/foo',
      }),
    ).toThrow(/must be an internal route/);
  });

  it('T3b: rejects ctaUrl without leading slash', () => {
    expect(() =>
      HeroBannerSchema.parse({
        imageId: VALID_UUID,
        headlineHi: 'Test',
        ctaUrl: 'products',
      }),
    ).toThrow(/must be an internal route/);
  });

  it('T4: rejects unknown accentMode enum value', () => {
    expect(() =>
      StorefrontConfigSchema.parse({ brandPalette: { accentMode: 'neon' } }),
    ).toThrow(/Invalid enum value/);
  });

  it('T6: STOREFRONT_CONFIG_DEFAULTS has exactly 5 trust pillars in Hindi', () => {
    expect(STOREFRONT_CONFIG_DEFAULTS.trustPillarsOverride).toHaveLength(5);
    const titles = STOREFRONT_CONFIG_DEFAULTS.trustPillarsOverride.map(p => p.titleHi);
    expect(titles).toContain('BIS हॉलमार्क');
    expect(titles).toContain('HUID ट्रैकिंग');
    expect(titles).toContain('एक्सचेंज');
    expect(titles).toContain('बायबैक');
    expect(titles).toContain('ट्राई एट होम');
  });

  it('T11: imageId in heroBanner must be a valid UUID', () => {
    expect(() =>
      HeroBannerSchema.parse({
        imageId: 'not-a-uuid',
        headlineHi: 'Test',
        ctaUrl: '/products',
      }),
    ).toThrow(/Invalid uuid/);
  });

  it('T12: accepts a hero banner backed by a local public image URL', () => {
    const result = HeroBannerSchema.parse({
      imageUrl: '/demo-shop/hero-bangles.jpg',
      headlineHi: 'Test',
      ctaUrl: '/products',
    });
    expect(result.imageUrl).toBe('/demo-shop/hero-bangles.jpg');
  });

  it('T2b: partial config keeps existing keys and applies Zod defaults for missing ones', () => {
    const result = StorefrontConfigSchema.parse({
      brandPalette: { accentMode: 'cool' as const },
      featuredCollectionIds: [VALID_UUID],
    });
    expect(result.heroBanners).toEqual([]);            // default applied
    expect(result.brandPalette.accentMode).toBe('cool'); // provided value kept
    expect(result.featuredCollectionIds).toEqual([VALID_UUID]);
  });
});
