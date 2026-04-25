import { z } from 'zod';

export const MovementType = z.enum([
  'PURCHASE','SALE','ADJUSTMENT_IN','ADJUSTMENT_OUT','TRANSFER_IN','TRANSFER_OUT',
]);
export type MovementType = z.infer<typeof MovementType>;

const POSITIVE_TYPES = ['PURCHASE','ADJUSTMENT_IN','TRANSFER_IN'] as const;

export const RecordMovementBodySchema = z.object({
  type: MovementType,
  quantityDelta: z.number().int().refine((n) => n !== 0, 'DELTA_NONZERO'),
  reason: z.string().min(3).max(500),
  sourceName: z.string().max(200).optional(),
  sourceId: z.string().uuid().optional(),
}).superRefine((data, ctx) => {
  const positive = (POSITIVE_TYPES as readonly string[]).includes(data.type);
  if (positive && data.quantityDelta < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'DELTA_SIGN_MISMATCH', path: ['quantityDelta'] });
  }
  if (!positive && data.quantityDelta > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'DELTA_SIGN_MISMATCH', path: ['quantityDelta'] });
  }
});
export type RecordMovementBodyDto = z.infer<typeof RecordMovementBodySchema>;

export const StockMovementResponseSchema = z.object({
  id:                z.string().uuid(),
  shopId:            z.string().uuid(),
  productId:         z.string().uuid(),
  type:              MovementType,
  reason:            z.string(),
  quantityDelta:     z.number().int(),
  balanceBefore:     z.number().int().nonnegative(),
  balanceAfter:      z.number().int().nonnegative(),
  sourceName:        z.string().nullable(),
  sourceId:          z.string().uuid().nullable(),
  recordedByUserId:  z.string().uuid(),
  recordedAt:        z.string(),
});
export type StockMovementResponse = z.infer<typeof StockMovementResponseSchema>;
