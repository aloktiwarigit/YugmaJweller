import { z } from 'zod';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const MAX_THRESHOLD_PAISE  = 1_000_000_000; // ₹1 crore in paise
const MAX_THRESHOLD_RUPEES = 10_000_000;    // same ceiling in rupees

const positiveDecimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, { message: 'VALUE_FORMAT_INVALID' })
  .refine((s) => parseFloat(s) > 0 && parseFloat(s) <= 100, { message: 'RATE_OUT_OF_RANGE' });

export const LoyaltyTierSchema = z.object({
  name:           z.string().min(1, { message: 'TIER_NAME_REQUIRED' }).max(20, { message: 'TIER_NAME_TOO_LONG' }),
  thresholdPaise: z.number().int({ message: 'THRESHOLD_MUST_BE_INTEGER' }).min(0, { message: 'THRESHOLD_MIN' }).max(MAX_THRESHOLD_PAISE, { message: 'THRESHOLD_MAX' }),
  badgeColor:     z.string().regex(HEX_COLOR_REGEX, { message: 'BADGE_COLOR_INVALID' }),
});
export type LoyaltyTier = z.infer<typeof LoyaltyTierSchema>;

export const LoyaltyConfigSchema = z.object({
  tiers:                    z.tuple([LoyaltyTierSchema, LoyaltyTierSchema, LoyaltyTierSchema]),
  earnRatePercentage:       positiveDecimalString,
  redemptionRatePercentage: positiveDecimalString,
});
export type LoyaltyConfig = z.infer<typeof LoyaltyConfigSchema>;

const thresholdRupeesString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, { message: 'VALUE_FORMAT_INVALID' })
  .refine((s) => parseFloat(s) >= 0 && parseFloat(s) <= MAX_THRESHOLD_RUPEES, { message: 'THRESHOLD_OUT_OF_RANGE' });

export const PatchLoyaltyTierSchema = z.object({
  type:            z.literal('tier'),
  index:           z.union([z.literal(0), z.literal(1), z.literal(2)]),
  name:            z.string().min(1, { message: 'TIER_NAME_REQUIRED' }).max(20, { message: 'TIER_NAME_TOO_LONG' }),
  thresholdRupees: thresholdRupeesString,
  badgeColor:      z.string().regex(HEX_COLOR_REGEX, { message: 'BADGE_COLOR_INVALID' }),
});
export type PatchLoyaltyTierDto = z.infer<typeof PatchLoyaltyTierSchema>;

export const PatchLoyaltyRateSchema = z.object({
  type:                     z.literal('rate'),
  earnRatePercentage:       positiveDecimalString,
  redemptionRatePercentage: positiveDecimalString,
});
export type PatchLoyaltyRateDto = z.infer<typeof PatchLoyaltyRateSchema>;

export const PatchLoyaltySchema = z.discriminatedUnion('type', [
  PatchLoyaltyTierSchema,
  PatchLoyaltyRateSchema,
]);
export type PatchLoyaltyDto = z.infer<typeof PatchLoyaltySchema>;

export const LOYALTY_DEFAULTS: LoyaltyConfig = {
  tiers: [
    { name: 'Silver',  thresholdPaise: 5_000_000,  badgeColor: '#C0C0C0' },
    { name: 'Gold',    thresholdPaise: 15_000_000,  badgeColor: '#FFD700' },
    { name: 'Diamond', thresholdPaise: 50_000_000,  badgeColor: '#B9F2FF' },
  ],
  earnRatePercentage:       '1.00',
  redemptionRatePercentage: '1.00',
};
