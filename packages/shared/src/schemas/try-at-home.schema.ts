import { z } from 'zod';

export const TRY_AT_HOME_DEFAULT_ENABLED = false;
export const TRY_AT_HOME_DEFAULT_MAX_PIECES = 3;

export const PatchTryAtHomeSchema = z.object({
  tryAtHomeEnabled: z.boolean().optional(),
  tryAtHomeMaxPieces: z.number().int().min(1).max(10).optional(),
});

export type PatchTryAtHomeDto = z.infer<typeof PatchTryAtHomeSchema>;

export interface TryAtHomeRow {
  tryAtHomeEnabled: boolean;
  tryAtHomeMaxPieces: number;
}
