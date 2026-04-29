import { z } from 'zod';
export const CreateCustomerSchema = z.object({
  phone:        z.string().regex(/^\+91[6-9]\d{9}$/, 'Valid Indian mobile required (+91XXXXXXXXXX)'),
  name:         z.string().min(1).max(200),
  email:        z.string().email().optional(),
  addressLine1: z.string().max(500).optional(),
  addressLine2: z.string().max(500).optional(),
  city:         z.string().max(100).optional(),
  state:        z.string().max(100).optional(),
  pincode:      z.string().regex(/^\d{6}$/).optional(),
  dobYear:      z.number().int().min(1900).max(2010).optional(),
  pan:          z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional(),
  notes:        z.string().max(2000).optional(),
});
export const UpdateCustomerSchema = z.object({
  name:         z.string().min(1).max(200).optional(),
  email:        z.string().email().optional(),
  addressLine1: z.string().max(500).optional(),
  addressLine2: z.string().max(500).optional(),
  city:         z.string().max(100).optional(),
  state:        z.string().max(100).optional(),
  pincode:      z.string().regex(/^\d{6}$/).optional(),
  dobYear:      z.number().int().min(1900).max(2010).optional(),
  pan:          z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional(),
  notes:        z.string().max(2000).optional(),
});
export const CustomerListQuerySchema = z.object({
  q:      z.string().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export const CustomerResponseSchema = z.object({
  id: z.string().uuid(), phone: z.string(), name: z.string(),
  email: z.string().nullable(), addressLine1: z.string().nullable(), addressLine2: z.string().nullable(),
  city: z.string().nullable(), state: z.string().nullable(), pincode: z.string().nullable(),
  dobYear: z.number().nullable(), hasPan: z.boolean(), notes: z.string().nullable(),
  viewingConsent: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
});
export type CreateCustomerDto  = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerDto  = z.infer<typeof UpdateCustomerSchema>;
export type CustomerListQuery  = z.infer<typeof CustomerListQuerySchema>;
export type CustomerResponse   = z.infer<typeof CustomerResponseSchema>;