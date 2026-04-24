import { z } from 'zod';

export const PURITY_VALUES = [
  'GOLD_24K', 'GOLD_22K', 'GOLD_20K', 'GOLD_18K', 'GOLD_14K', 'SILVER_999', 'SILVER_925',
] as const;

export type PurityKey = (typeof PURITY_VALUES)[number];

export const SetRateOverrideDtoSchema = z.object({
  purity: z.enum(PURITY_VALUES),
  overrideRupees: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a positive number with at most 2 decimal places')
    .refine(
      (v) => {
        const n = parseFloat(v);
        return n > 0 && n < 200000;
      },
      'Rate must be between ₹1 and ₹2,00,000 per gram',
    ),
  reason: z.string().min(3).max(500),
  validUntilIso: z.string().datetime().optional(),
});

export type SetRateOverrideDto = z.infer<typeof SetRateOverrideDtoSchema>;
