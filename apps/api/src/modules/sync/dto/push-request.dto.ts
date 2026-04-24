import { z } from 'zod';

const TableChangesSchema = z.object({
  created: z.array(z.record(z.unknown())).default([]),
  updated: z.array(z.record(z.unknown())).default([]),
  deleted: z.array(z.object({ id: z.string() })).default([]),
});

export const PushRequestSchema = z.object({
  changes: z.record(TableChangesSchema).default({}),
  idempotencyKey: z.string().uuid('idempotencyKey must be a UUID v4'),
});

export type PushRequestDto = z.infer<typeof PushRequestSchema>;
