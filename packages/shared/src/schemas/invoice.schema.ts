import { z } from 'zod';

const PaiseString = z.string().regex(/^\d+$/, 'paise must be non-negative integer string');
const DecimalWeight = z.string().regex(/^\d+(\.\d{1,4})?$/, 'weight must be DECIMAL(*,4)');
const DecimalPct    = z.string().regex(/^\d+(\.\d{1,2})?$/, 'percent must be DECIMAL(5,2)');
const HuidString    = z.string().regex(/^[A-Z0-9]{6}$/, 'HUID must be 6 uppercase alphanumeric');
const PhoneIndia    = z.string().regex(/^[6-9]\d{9}$/, 'phone must be 10 digits starting 6-9');
const Uuid          = z.string().uuid();

export const InvoiceLineSchema = z.object({
  productId:         Uuid.optional(),
  description:       z.string().min(1).max(500),
  huid:              HuidString.nullable().optional(),
  metalType:         z.enum(['GOLD', 'SILVER', 'PLATINUM']).optional(),
  purity:            z.string().max(16).optional(),
  netWeightG:        DecimalWeight.optional(),
  makingChargePct:   DecimalPct.optional(),
  stoneChargesPaise: PaiseString.default('0'),
  hallmarkFeePaise:  PaiseString.default('0'),
});

// PAN: normalize to uppercase + strip spaces, then validate format AAAAA9999A.
// Accepts lowercase input so non-mobile clients can pass unnormalized PANs.
const PanString = z
  .string()
  .transform((v) => v.toUpperCase().replace(/\s+/g, ''))
  .pipe(z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format — e.g. ABCDE1234F'));

export const Form60Schema = z.object({
  name:                       z.string().min(2),
  address:                    z.string().min(10),
  reasonForNoPan:             z.string().min(5),
  estimatedAnnualIncomePaise: z.string().regex(/^\d+$/, 'Must be a non-negative integer string'),
});

export const CreateInvoiceSchema = z.object({
  // Existing CRM customer record. Validated server-side to belong to the current
  // tenant before persistence. Drives loyalty accrual (Story 8.1) — invoices
  // without a customerId are treated as walk-ins and accrue no points.
  customerId:        Uuid.optional(),
  customerName:      z.string().min(1).max(200),
  customerPhone:     PhoneIndia.optional(),
  lines:             z.array(InvoiceLineSchema).min(1).max(50),
  // PAN Rule 114B — required when total >= Rs 2,00,000; normalised to uppercase before sending
  pan:               PanString.optional(),
  form60Data:        Form60Schema.optional(),
  invoiceType:       z.enum(['B2C', 'B2B_WHOLESALE']).default('B2C'),
  buyerGstin:        z.string().length(15).optional(),
  buyerBusinessName: z.string().min(2).max(200).optional(),
}).refine(
  (data) => data.invoiceType !== 'B2B_WHOLESALE' || data.buyerGstin != null,
  { message: 'buyerGstin is required for B2B_WHOLESALE invoices', path: ['buyerGstin'] },
);

export type CreateInvoiceDtoType = z.infer<typeof CreateInvoiceSchema>;
export type InvoiceLineDtoType   = z.infer<typeof InvoiceLineSchema>;

// Response schema — paise emitted as decimal strings (BigInt-safe across JSON boundaries).
export const InvoiceItemResponseSchema = z.object({
  id:                 Uuid,
  productId:          Uuid.nullable(),
  description:        z.string(),
  hsnCode:            z.string(),
  huid:               z.string().nullable(),
  metalType:          z.string().nullable(),
  purity:             z.string().nullable(),
  netWeightG:         z.string().nullable(),
  ratePerGramPaise:   z.string().nullable(),
  makingChargePct:    z.string().nullable(),
  goldValuePaise:     PaiseString,
  makingChargePaise:  PaiseString,
  stoneChargesPaise:  PaiseString,
  hallmarkFeePaise:   PaiseString,
  gstMetalPaise:      PaiseString,
  gstMakingPaise:     PaiseString,
  lineTotalPaise:     PaiseString,
  sortOrder:          z.number().int().nonnegative(),
});

export const InvoiceResponseSchema = z.object({
  id:                 Uuid,
  shopId:             Uuid,
  invoiceNumber:      z.string(),
  invoiceType:        z.enum(['B2C', 'B2B_WHOLESALE']),
  customerId:         Uuid.nullable(),
  customerName:       z.string(),
  customerPhone:      z.string().nullable(),
  status:             z.enum(['DRAFT', 'ISSUED', 'VOIDED']),
  subtotalPaise:      PaiseString,
  gstMetalPaise:      PaiseString,
  gstMakingPaise:     PaiseString,
  totalPaise:         PaiseString,
  idempotencyKey:     z.string(),
  issuedAt:           z.string().datetime().nullable(),
  createdByUserId:    Uuid,
  createdAt:          z.string().datetime(),
  updatedAt:          z.string().datetime(),
  lines:              z.array(InvoiceItemResponseSchema),
  // B2B fields (null/absent for B2C invoices)
  buyerGstin:         z.string().nullable().optional(),
  buyerBusinessName:  z.string().nullable().optional(),
  gstTreatment:       z.enum(['CGST_SGST', 'IGST']).optional(),
  cgstMetalPaise:     PaiseString.optional(),
  sgstMetalPaise:     PaiseString.optional(),
  cgstMakingPaise:    PaiseString.optional(),
  sgstMakingPaise:    PaiseString.optional(),
  igstMetalPaise:     PaiseString.optional(),
  igstMakingPaise:    PaiseString.optional(),
  // Void fields (null/absent unless invoice is VOIDED)
  voidedAt:           z.string().datetime().nullable().optional(),
  voidedByUserId:     Uuid.nullable().optional(),
  voidReason:         z.string().nullable().optional(),
});

export type InvoiceItemResponse = z.infer<typeof InvoiceItemResponseSchema>;
export type InvoiceResponse     = z.infer<typeof InvoiceResponseSchema>;

const PositivePaiseString = z
  .string()
  .regex(/^[1-9]\d*$/, 'paise must be a positive integer string (> 0)');

export const RecordCashPaymentSchema = z.object({
  // Paise value as string to avoid JavaScript precision loss with large integers.
  // Must be > 0 to match the payments.amount_paise check constraint.
  amountPaise: PositivePaiseString,
  override: z.object({
    justification: z.string().min(1).max(1000),
  }).optional(),
});

export type RecordCashPaymentDto = z.infer<typeof RecordCashPaymentSchema>;
