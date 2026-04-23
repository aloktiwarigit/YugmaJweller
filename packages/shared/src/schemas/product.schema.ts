import { z } from 'zod';

const weightString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'WEIGHT_FORMAT_INVALID');

const METAL = z.enum(['GOLD', 'SILVER', 'PLATINUM']);
const STATUS = z.enum(['IN_STOCK', 'SOLD', 'RESERVED', 'ON_APPROVAL', 'WITH_KARIGAR']);
const HUID = z.string().regex(/^[A-Z0-9]{6}$/, 'HUID_FORMAT_INVALID');

export const CreateProductSchema = z.object({
  categoryId:               z.string().uuid().optional(),
  sku:                      z.string().min(1).max(100),
  metal:                    METAL,
  purity:                   z.string().min(1).max(10),
  grossWeightG:             weightString,
  netWeightG:               weightString,
  stoneWeightG:             weightString.optional().default('0.0000'),
  stoneDetails:             z.string().max(500).optional(),
  makingChargeOverridePct:  z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  huid:                     HUID.optional(),
  status:                   STATUS.optional().default('IN_STOCK'),
});

export type CreateProductDto = z.input<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial();
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;

export const ProductResponseSchema = z.object({
  id:                       z.string().uuid(),
  shopId:                   z.string().uuid(),
  categoryId:               z.string().uuid().nullable(),
  sku:                      z.string(),
  metal:                    METAL,
  purity:                   z.string(),
  grossWeightG:             z.string(),
  netWeightG:               z.string(),
  stoneWeightG:             z.string(),
  stoneDetails:             z.string().nullable(),
  makingChargeOverridePct:  z.string().nullable(),
  huid:                     z.string().nullable(),
  status:                   STATUS,
  publishedAt:              z.string().nullable(),
  createdByUserId:          z.string().uuid(),
  createdAt:                z.string(),
  updatedAt:                z.string(),
});

export type ProductResponse = z.infer<typeof ProductResponseSchema>;
