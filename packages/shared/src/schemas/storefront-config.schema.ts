import { z } from 'zod';

export const HeroBannerSchema = z.object({
  imageId:    z.string().uuid(),
  headlineHi: z.string().min(1).max(120),
  headlineEn: z.string().max(120).optional(),
  ctaUrl:     z.string().regex(/^\//, 'must be an internal route starting with /'),
  validFrom:  z.string().datetime().optional(),
  validTo:    z.string().datetime().optional(),
});

export const GiftPersonaOverrideSchema = z.object({
  persona: z.string().min(1),
  href:    z.string().min(1),
  label:   z.string().min(1),
});

export const TrustPillarSchema = z.object({
  titleHi:       z.string().min(1),
  titleEn:       z.string().optional(),
  descriptionHi: z.string().min(1),
});

export const BrandPaletteSchema = z.object({
  accentMode:  z.enum(['warm', 'cool', 'luxe']).optional(),
  heroPattern: z.enum(['devanagari-numerals', 'lotus', 'temple', 'none']).optional(),
});

export const StorefrontConfigSchema = z.object({
  heroBanners:           z.array(HeroBannerSchema).default([]),
  featuredCollectionIds: z.array(z.string().uuid()).default([]),
  premiumCollectionIds:  z.array(z.string().uuid()).default([]),
  giftPersonaOverrides:  z.array(GiftPersonaOverrideSchema).default([]),
  brandPalette:          BrandPaletteSchema.default({}),
  trustPillarsOverride:  z.array(TrustPillarSchema).default([]),
});

export type StorefrontConfig = z.infer<typeof StorefrontConfigSchema>;

export const PatchStorefrontConfigSchema = StorefrontConfigSchema.partial();
export type PatchStorefrontConfigDto = z.infer<typeof PatchStorefrontConfigSchema>;

export const STOREFRONT_CONFIG_DEFAULTS: StorefrontConfig = {
  heroBanners:           [],
  featuredCollectionIds: [],
  premiumCollectionIds:  [],
  giftPersonaOverrides:  [],
  brandPalette:          {},
  trustPillarsOverride: [
    {
      titleHi:       'BIS हॉलमार्क',
      titleEn:       'BIS Hallmark',
      descriptionHi: 'सोने की शुद्धता प्रमाणित',
    },
    {
      titleHi:       'HUID ट्रैकिंग',
      titleEn:       'HUID Tracking',
      descriptionHi: 'हर आभूषण का विशेष ID',
    },
    {
      titleHi:       'एक्सचेंज',
      titleEn:       'Exchange',
      descriptionHi: 'पुराने सोने पर उचित मूल्य',
    },
    {
      titleHi:       'बायबैक',
      titleEn:       'Buyback',
      descriptionHi: 'खरीदी कीमत की गारंटी',
    },
    {
      titleHi:       'ट्राई एट होम',
      titleEn:       'Try at Home',
      descriptionHi: 'घर पर देखें, पसंद आए तो लें',
    },
  ],
};
