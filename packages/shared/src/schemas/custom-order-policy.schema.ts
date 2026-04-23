import { z } from 'zod';

export const PatchCustomOrderPolicySchema = z.object({
  customOrderPolicyText: z.string().max(2000),
});

export type PatchCustomOrderPolicyDto = z.infer<typeof PatchCustomOrderPolicySchema>;
