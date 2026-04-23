import { z } from 'zod';

const ChannelWithSmsSchema = z.object({ push: z.boolean(), sms: z.boolean() });
const ChannelPushOnlySchema = z.object({ push: z.boolean() });

export const NotificationPrefsSchema = z.object({
  orderUpdates:    ChannelWithSmsSchema,
  loyaltyUpdates:  ChannelWithSmsSchema,
  rateAlerts:      ChannelWithSmsSchema,
  staffActivity:   ChannelPushOnlySchema,
  paymentReceipts: ChannelWithSmsSchema,
});

export type NotificationPrefsConfig = z.infer<typeof NotificationPrefsSchema>;

export const PatchNotificationPrefsSchema = z.object({
  orderUpdates:    z.object({ push: z.boolean().optional(), sms: z.boolean().optional() }).optional(),
  loyaltyUpdates:  z.object({ push: z.boolean().optional(), sms: z.boolean().optional() }).optional(),
  rateAlerts:      z.object({ push: z.boolean().optional(), sms: z.boolean().optional() }).optional(),
  staffActivity:   z.object({ push: z.boolean().optional() }).optional(),
  paymentReceipts: z.object({ push: z.boolean().optional(), sms: z.boolean().optional() }).optional(),
});

export type PatchNotificationPrefsDto = z.infer<typeof PatchNotificationPrefsSchema>;

export const NOTIFICATION_PREFS_DEFAULTS: NotificationPrefsConfig = {
  orderUpdates:    { push: true, sms: false },
  loyaltyUpdates:  { push: true, sms: false },
  rateAlerts:      { push: true, sms: false },
  staffActivity:   { push: true },
  paymentReceipts: { push: true, sms: false },
};
