import { z } from 'zod';

export const PERMISSION_KEYS = [
  'billing.create',
  'billing.void',
  'inventory.edit',
  'settings.edit',
  'reports.view',
  'analytics.view',
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];

export const InviteStaffSchema = z.object({
  phone:        z.string().regex(/^\+91[6-9]\d{9}$/, { message: 'PHONE_INVALID' }),
  role:         z.enum(['shop_staff', 'shop_manager']),
  display_name: z.string().min(1, { message: 'NAME_REQUIRED' }).max(100, { message: 'NAME_TOO_LONG' }),
});
export type InviteStaffDto = z.infer<typeof InviteStaffSchema>;

export const UpdatePermissionSchema = z.object({
  permission_key: z.enum(PERMISSION_KEYS),
  is_enabled:     z.boolean(),
});
export type UpdatePermissionDto = z.infer<typeof UpdatePermissionSchema>;

export const RolePermissionsRowSchema = z.object({
  role:        z.enum(['shop_manager', 'shop_staff']),
  permissions: z.record(z.string(), z.boolean()),
});
export type RolePermissionsRow = z.infer<typeof RolePermissionsRowSchema>;
