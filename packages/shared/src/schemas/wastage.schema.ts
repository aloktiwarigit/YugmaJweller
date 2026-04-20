import { z } from 'zod';
import { ProductCategory } from './making-charges.schema';

export { ProductCategory };

const positiveDecimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'VALUE_FORMAT_INVALID')
  .refine((s) => parseFloat(s) > 0, 'VALUE_POSITIVE_REQUIRED');

export const WastageConfigSchema = z.object({
  category: ProductCategory,
  percent: positiveDecimalString,
});
export type WastageConfig = z.infer<typeof WastageConfigSchema>;

export const PatchWastageSchema = WastageConfigSchema;
export type PatchWastageDto = z.infer<typeof PatchWastageSchema>;

export const WastageArraySchema = z.array(WastageConfigSchema);

export const WASTAGE_DEFAULTS: WastageConfig[] = [
  { category: 'RINGS', percent: '2.00' },
  { category: 'CHAINS', percent: '1.50' },
  { category: 'BANGLES', percent: '1.50' },
  { category: 'BRIDAL', percent: '3.00' },
  { category: 'SILVER', percent: '1.00' },
  { category: 'WHOLESALE', percent: '1.00' },
];
