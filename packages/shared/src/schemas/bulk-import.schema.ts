import { z } from 'zod';

const weightCol = z.string().regex(/^\d+(\.\d{1,4})?$/, 'WEIGHT_FORMAT_INVALID');

export const BulkImportRowSchema = z.object({
  sku:                    z.string().min(1).max(100),
  category:               z.string().min(1).max(100),
  metal:                  z.enum(['GOLD', 'SILVER', 'PLATINUM']),
  purity:                 z.enum(['24K', '22K', '20K', '18K', '14K', '999', '925']),
  gross_weight:           weightCol,
  net_weight:             weightCol,
  stone_weight:           weightCol.optional().default('0.0000'),
  stone_details:          z.string().max(500).optional(),
  making_charge_override: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  huid:                   z.string().regex(/^[A-Z0-9]{6}$/).optional(),
  image_urls:             z.string().optional(),
}).superRefine((d, ctx) => {
  const gross = parseFloat(d.gross_weight);
  const net   = parseFloat(d.net_weight);
  const stone = parseFloat(d.stone_weight ?? '0.0000');
  if (!isNaN(gross) && !isNaN(net) && net > gross) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'NET_WEIGHT_EXCEEDS_GROSS', path: ['net_weight'] });
  }
  if (!isNaN(gross) && !isNaN(net) && !isNaN(stone) && net + stone > gross) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'NET_PLUS_STONE_EXCEEDS_GROSS', path: ['stone_weight'] });
  }
});

export type BulkImportRow = z.infer<typeof BulkImportRowSchema>;

export const BulkImportJobStatusSchema = z.object({
  jobId:        z.string(),
  status:       z.enum(['pending', 'processing', 'completed', 'failed']),
  total:        z.number().int(),
  processed:    z.number().int(),
  succeeded:    z.number().int(),
  failed:       z.number().int(),
  errorFileUrl: z.string().optional(),
});

export type BulkImportJobStatus = z.infer<typeof BulkImportJobStatusSchema>;
