import { describe, it, expect } from 'vitest';
import { BulkImportRowSchema } from './bulk-import.schema';

describe('BulkImportRowSchema', () => {
  const valid = {
    sku: 'RING-001', category: 'Rings',
    metal: 'GOLD', purity: '22K',
    gross_weight: '10.5000', net_weight: '9.0000',
  };

  it('parses a valid minimal row', () => {
    const r = BulkImportRowSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.stone_weight).toBe('0.0000');
    }
  });

  it('rejects empty sku', () => {
    const r = BulkImportRowSchema.safeParse({ ...valid, sku: '' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid metal', () => {
    const r = BulkImportRowSchema.safeParse({ ...valid, metal: 'BRONZE' });
    expect(r.success).toBe(false);
  });

  it('rejects weight not matching pattern', () => {
    const r = BulkImportRowSchema.safeParse({ ...valid, gross_weight: 'abc' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid HUID', () => {
    const r = BulkImportRowSchema.safeParse({ ...valid, huid: 'bad!!' });
    expect(r.success).toBe(false);
  });

  it('accepts valid HUID', () => {
    const r = BulkImportRowSchema.safeParse({ ...valid, huid: 'ABC123' });
    expect(r.success).toBe(true);
  });

  it('rejects gross_weight < net_weight', () => {
    const r = BulkImportRowSchema.safeParse({ ...valid, gross_weight: '5.0000', net_weight: '9.0000' });
    expect(r.success).toBe(false);
  });

  it('rejects net + stone exceeding gross', () => {
    const r = BulkImportRowSchema.safeParse({
      ...valid, gross_weight: '10.0000', net_weight: '8.0000', stone_weight: '3.0000',
    });
    expect(r.success).toBe(false);
  });
});
