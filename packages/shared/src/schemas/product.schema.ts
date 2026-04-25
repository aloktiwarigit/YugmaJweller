import { z } from 'zod';

const weightString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, 'WEIGHT_FORMAT_INVALID')
  .refine((v) => parseFloat(v) > 0, 'WEIGHT_MUST_BE_POSITIVE');

const METAL = z.enum(['GOLD', 'SILVER', 'PLATINUM']);
const STATUS = z.enum(['IN_STOCK', 'SOLD', 'RESERVED', 'ON_APPROVAL', 'WITH_KARIGAR']);
const HUID = z.string().regex(/^[A-Z0-9]{6}$/, 'HUID_FORMAT_INVALID');

const ProductBaseSchema = z.object({
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

export const CreateProductSchema = ProductBaseSchema.superRefine((data, ctx) => {
  const gross = parseFloat(data.grossWeightG);
  const net = parseFloat(data.netWeightG);
  const stone = parseFloat(data.stoneWeightG ?? '0.0000');
  if (!isNaN(gross) && !isNaN(net) && net > gross) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'NET_WEIGHT_EXCEEDS_GROSS', path: ['netWeightG'] });
  }
  if (!isNaN(gross) && !isNaN(net) && !isNaN(stone) && net + stone > gross) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'NET_PLUS_STONE_EXCEEDS_GROSS', path: ['stoneWeightG'] });
  }
});
export type CreateProductDto = z.input<typeof CreateProductSchema>;

export const UpdateProductSchema = ProductBaseSchema.partial().superRefine((data, ctx) => {
  const gross = data.grossWeightG !== undefined ? parseFloat(data.grossWeightG) : NaN;
  const net = data.netWeightG !== undefined ? parseFloat(data.netWeightG) : NaN;
  const stone = data.stoneWeightG !== undefined ? parseFloat(data.stoneWeightG) : NaN;
  if (!isNaN(gross) && !isNaN(net) && net > gross) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'NET_WEIGHT_EXCEEDS_GROSS', path: ['netWeightG'] });
  }
  if (!isNaN(gross) && !isNaN(net) && !isNaN(stone) && net + stone > gross) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'NET_PLUS_STONE_EXCEEDS_GROSS', path: ['stoneWeightG'] });
  }
});
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
  quantity:                 z.number().int().nonnegative(),
  publishedAt:              z.string().nullable(),
  publishedByUserId:        z.string().uuid().nullable(),
  createdByUserId:          z.string().uuid(),
  createdAt:                z.string(),
  updatedAt:                z.string(),
});

export type ProductResponse = z.infer<typeof ProductResponseSchema>;

export const UpdateStatusDtoSchema = z.object({
  status: STATUS,
  note: z.string().max(500).optional(),
});
export type UpdateStatusDto = z.infer<typeof UpdateStatusDtoSchema>;
