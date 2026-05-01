import { z } from 'zod';

export const CreateTenantDto = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  displayName: z.string().min(1).max(120),
});
export type CreateTenantDtoT = z.infer<typeof CreateTenantDto>;

export const UpdateTenantDto = z.object({
  displayName: z.string().min(1).max(120).optional(),
  contactPhone: z.string().regex(/^\+?\d{8,15}$/).optional(),
  aboutText: z.string().max(2000).optional(),
}).strict();
export type UpdateTenantDtoT = z.infer<typeof UpdateTenantDto>;

export const SuspendTenantDto = z.object({
  reason: z.string().min(3).max(500),
});
export type SuspendTenantDtoT = z.infer<typeof SuspendTenantDto>;

export const UpsertSubscriptionDto = z.object({
  shopId: z.string().uuid(),
  plan: z.enum(['trial', 'starter', 'growth', 'enterprise']),
  status: z.enum(['active', 'suspended', 'cancelled']).optional(),
  mrrPaise: z.number().int().nonnegative(),
  billingCycleStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type UpsertSubscriptionDtoT = z.infer<typeof UpsertSubscriptionDto>;

export const ImpersonateDto = z.object({
  targetShopId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});
export type ImpersonateDtoT = z.infer<typeof ImpersonateDto>;
