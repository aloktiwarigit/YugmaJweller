import { appSchema, tableSchema } from '@nozbe/watermelondb';

// Weight columns stored as string — NEVER as float (CLAUDE.md: no FLOAT for weights)
export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'products',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'sku', type: 'string' },
        { name: 'metal', type: 'string' },
        { name: 'purity', type: 'string' },
        { name: 'gross_weight_g', type: 'string' },
        { name: 'net_weight_g', type: 'string' },
        { name: 'stone_weight_g', type: 'string' },
        { name: 'huid', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'published_at', type: 'number', isOptional: true },
        { name: 'pending_sync', type: 'boolean' },
        { name: 'server_updated_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});
