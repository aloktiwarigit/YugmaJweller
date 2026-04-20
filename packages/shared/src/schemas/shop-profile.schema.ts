import { z } from 'zod';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const AddressSchema = z.object({
  street:   z.string().min(1, { message: 'STREET_REQUIRED' }).max(200, { message: 'STREET_TOO_LONG' }),
  city:     z.string().min(1, { message: 'CITY_REQUIRED' }).max(100, { message: 'CITY_TOO_LONG' }),
  state:    z.string().min(1, { message: 'STATE_REQUIRED' }).max(100, { message: 'STATE_TOO_LONG' }),
  pin_code: z.string().regex(/^\d{6}$/, { message: 'PIN_INVALID' }),
});

export const OperatingHoursDaySchema = z.object({
  enabled: z.boolean(),
  open:    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'TIME_INVALID' }).nullable(),
  close:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'TIME_INVALID' }).nullable(),
}).superRefine((day, ctx) => {
  if (day.enabled && (day.open === null || day.close === null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'HOURS_REQUIRED_WHEN_ENABLED' });
  }
  if (!day.enabled && (day.open !== null || day.close !== null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'HOURS_MUST_BE_NULL_WHEN_DISABLED' });
  }
});

export const OperatingHoursSchema = z.object({
  mon: OperatingHoursDaySchema, tue: OperatingHoursDaySchema,
  wed: OperatingHoursDaySchema, thu: OperatingHoursDaySchema,
  fri: OperatingHoursDaySchema, sat: OperatingHoursDaySchema,
  sun: OperatingHoursDaySchema,
});

export const PatchShopProfileSchema = z.object({
  name:              z.string().min(1, { message: 'NAME_REQUIRED' }).max(120, { message: 'NAME_TOO_LONG' }).optional(),
  address:           AddressSchema.optional(),
  gstin:             z.string().regex(GSTIN_REGEX, { message: 'GSTIN_INVALID' }).optional().nullable(),
  bis_registration:  z.string().max(50, { message: 'BIS_TOO_LONG' }).optional().nullable(),
  contact_phone:     z.string().regex(/^\+91[6-9]\d{9}$/, { message: 'PHONE_INVALID' }).optional().nullable(),
  operating_hours:   OperatingHoursSchema.optional(),
  about_text:        z.string().max(500, { message: 'ABOUT_TOO_LONG' }).optional().nullable(),
  logo_url:          z.string().url({ message: 'LOGO_URL_INVALID' }).optional().nullable(),
  years_in_business: z.number().int({ message: 'YEARS_MUST_BE_INT' }).min(0, { message: 'YEARS_MIN' }).max(200, { message: 'YEARS_MAX' }).optional().nullable(),
}).strict();

export type PatchShopProfileDto = z.infer<typeof PatchShopProfileSchema>;
export type AddressDto          = z.infer<typeof AddressSchema>;
export type OperatingHoursDto   = z.infer<typeof OperatingHoursSchema>;
export type OperatingHoursDayDto = z.infer<typeof OperatingHoursDaySchema>;

export interface ShopProfileRow {
  name: string;
  address: AddressDto | null;
  gstin: string | null;
  bis_registration: string | null;
  contact_phone: string | null;
  operating_hours: OperatingHoursDto | null;
  about_text: string | null;
  logo_url: string | null;
  years_in_business: number | null;
  updated_at: string;
}

export const ShopProfileRowSchema = z.object({
  name:              z.string(),
  address:           AddressSchema.nullable(),
  gstin:             z.string().nullable(),
  bis_registration:  z.string().nullable(),
  contact_phone:     z.string().nullable(),
  operating_hours:   OperatingHoursSchema.nullable(),
  about_text:        z.string().nullable(),
  logo_url:          z.string().nullable(),
  years_in_business: z.number().nullable(),
  updated_at:        z.string(),
});
