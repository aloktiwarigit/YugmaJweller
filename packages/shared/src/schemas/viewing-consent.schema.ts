import { z } from 'zod';

export const UpdateViewingConsentSchema = z.object({
  consentGiven: z.boolean(),
});

export const ViewingConsentResponseSchema = z.object({
  consentGiven:   z.boolean(),
  consentVersion: z.string(),
  consentedAt:    z.string().nullable(),
  withdrawnAt:    z.string().nullable(),
});

export type UpdateViewingConsentDto = z.infer<typeof UpdateViewingConsentSchema>;
export type ViewingConsentResponse = z.infer<typeof ViewingConsentResponseSchema>;
