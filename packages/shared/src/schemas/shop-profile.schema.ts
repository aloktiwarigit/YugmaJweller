import { z } from 'zod';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const AddressSchema = z.object({
  street:   z.string().min(1).max(200),
  city:     z.string().min(1).max(100),
  state:    z.string().min(1).max(100),
  pin_code: z.string().regex(/^\d{6}$/, { message: 'PIN_INVALID' }),
});

export const OperatingHoursDaySchema = z.object({
  enabled: z.boolean(),
  open:    z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  close:   z.string().regex(/^\d{2}:\d{2}$/).nullable(),
});

export const OperatingHoursSchema = z.object({
  mon: OperatingHoursDaySchema, tue: OperatingHoursDaySchema,
  wed: OperatingHoursDaySchema, thu: OperatingHoursDaySchema,
  fri: OperatingHoursDaySchema, sat: OperatingHoursDaySchema,
  sun: OperatingHoursDaySchema,
});

export const PatchShopProfileSchema = z.object({
  name:              z.string().min(1, { message: 'NAME_REQUIRED' }).max(120).optional(),
  address:           AddressSchema.optional(),
  gstin:             z.string().regex(GSTIN_REGEX, { message: 'GSTIN_INVALID' }).optional().nullable(),
  bis_registration:  z.string().max(50).optional().nullable(),
  contact_phone:     z.string().regex(/^\+91[6-9]\d{9}$/, { message: 'PHONE_INVALID' }).optional().nullable(),
  operating_hours:   OperatingHoursSchema.optional(),
  about_text:        z.string().max(500, { message: 'ABOUT_TOO_LONG' }).optional().nullable(),
  logo_url:          z.string().url().optional().nullable(),
  years_in_business: z.number().int().min(0).max(200).optional().nullable(),
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
