import { z } from 'zod';

// Runtime loyalty schemas (state + transactions). Distinct from loyalty-config.schema.ts
// which models the per-shop tier/rate configuration in shop_settings.

export const LoyaltyTransactionTypeSchema = z.enum([
  'ACCRUAL',
  'REDEMPTION',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'REVERSAL',
]);
export type LoyaltyTransactionType = z.infer<typeof LoyaltyTransactionTypeSchema>;

export const LoyaltyStateSchema = z.object({
  pointsBalance:  z.number().int().nonnegative(),
  lifetimePoints: z.number().int().nonnegative(),
  currentTier:    z.string().nullable(),
  tierSince:      z.string().nullable(),
});
export type LoyaltyState = z.infer<typeof LoyaltyStateSchema>;

export const LoyaltyTransactionSchema = z.object({
  id:             z.string().uuid(),
  type:           LoyaltyTransactionTypeSchema,
  pointsDelta:    z.number().int(),
  balanceBefore:  z.number().int().nonnegative(),
  balanceAfter:   z.number().int().nonnegative(),
  reason:         z.string(),
  invoiceId:      z.string().uuid().nullable(),
  createdAt:      z.string(),
});
export type LoyaltyTransaction = z.infer<typeof LoyaltyTransactionSchema>;

export const AdjustPointsBodySchema = z.object({
  pointsDelta: z
    .number()
    .int({ message: 'POINTS_DELTA_MUST_BE_INTEGER' })
    .refine((n) => n !== 0, { message: 'POINTS_DELTA_NONZERO' })
    .refine((n) => Math.abs(n) <= 1_000_000, { message: 'POINTS_DELTA_OUT_OF_RANGE' }),
  reason: z
    .string()
    .min(3, { message: 'REASON_TOO_SHORT' })
    .max(500, { message: 'REASON_TOO_LONG' }),
});
export type AdjustPointsBody = z.infer<typeof AdjustPointsBodySchema>;
