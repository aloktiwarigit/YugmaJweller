import { z } from 'zod';

export const BarcodeDataSchema = z.object({
  barcodeValue: z.string(),
  sku: z.string(),
  productName: z.string(),
  weightDisplay: z.string(),
  huid: z.string().nullable(),
  metal: z.string(),
  purity: z.string(),
});

export type BarcodeData = z.infer<typeof BarcodeDataSchema>;

export const GenerateBarcodesRequestSchema = z.object({
  productIds: z
    .array(z.string().uuid())
    .min(1, 'AT_LEAST_ONE_PRODUCT_ID_REQUIRED')
    .max(50, 'MAX_50_PRODUCTS_PER_REQUEST'),
});

export type GenerateBarcodesRequest = z.infer<typeof GenerateBarcodesRequestSchema>;
