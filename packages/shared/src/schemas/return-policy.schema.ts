import { z } from 'zod';

export const PatchReturnPolicySchema = z.object({
  returnPolicyText: z.string().max(2000),
});

export type PatchReturnPolicyDto = z.infer<typeof PatchReturnPolicySchema>;
