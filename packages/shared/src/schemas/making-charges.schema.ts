import { z } from 'zod';

export const ProductCategory = z.enum([
  'RINGS', 'CHAINS', 'BANGLES', 'BRIDAL', 'SILVER', 'WHOLESALE',
]);
export type ProductCategory = z.infer<typeof ProductCategory>;

const numericDecimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'VALUE_FORMAT_INVALID')
  .refine((s) => parseFloat(s) > 0, 'VALUE_POSITIVE_REQUIRED');

export const MakingChargeConfigSchema = z.object({
  category: ProductCategory,
  type: z.enum(['percent', 'fixed_per_gram']),
  value: numericDecimalString,
});
export type MakingChargeConfig = z.infer<typeof MakingChargeConfigSchema>;

export const MakingChargesArraySchema = z.array(MakingChargeConfigSchema);

export const PatchMakingChargesSchema = z
  .array(MakingChargeConfigSchema)
  .min(1, 'ARRAY_MIN_ONE')
  .superRefine((items, ctx) => {
    for (const [i, item] of items.entries()) {
      if (item.type === 'percent' && parseFloat(item.value) > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PERCENT_MAX_100',
          path: [i, 'value'],
        });
      }
    }
  });
export type PatchMakingChargesDto = z.infer<typeof PatchMakingChargesSchema>;

export const MAKING_CHARGE_DEFAULTS: MakingChargeConfig[] = [
  { category: 'RINGS',     type: 'percent', value: '12.00' },
  { category: 'CHAINS',    type: 'percent', value: '10.00' },
  { category: 'BANGLES',   type: 'percent', value: '8.00'  },
  { category: 'BRIDAL',    type: 'percent', value: '15.00' },
  { category: 'SILVER',    type: 'percent', value: '5.00'  },
  { category: 'WHOLESALE', type: 'percent', value: '7.00'  },
];
