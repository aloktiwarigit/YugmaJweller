import { z } from 'zod';

export const RATE_LOCK_DEFAULT_DAYS = 7;

export const PatchRateLockSchema = z.object({
  rateLockDays: z.number().int().min(1).max(30),
});

export type PatchRateLockDto = z.infer<typeof PatchRateLockSchema>;

export interface RateLockRow {
  rateLockDays: number;
}
