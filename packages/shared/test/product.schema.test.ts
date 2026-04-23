import { describe, it, expect } from 'vitest';
import { CreateProductSchema, UpdateProductSchema } from '../src/schemas/product.schema';

describe('CreateProductSchema', () => {
  const valid = {
    sku: 'RING-001',
    metal: 'GOLD',
    purity: '22K',
    grossWeightG: '10.5000',
    netWeightG: '9.0000',
    stoneWeightG: '0.5000',
    status: 'IN_STOCK',
    huid: 'AB1234',
  };

  it('accepts a valid product', () => {
    expect(CreateProductSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects non-decimal grossWeightG', () => {
    expect(CreateProductSchema.safeParse({ ...valid, grossWeightG: 'abc' }).success).toBe(false);
  });

  it('accepts optional huid as 6 uppercase alphanumeric', () => {
    expect(CreateProductSchema.safeParse({ ...valid, huid: 'AB1234' }).success).toBe(true);
  });

  it('rejects lowercase huid', () => {
    expect(CreateProductSchema.safeParse({ ...valid, huid: 'ab1234' }).success).toBe(false);
  });

  it('rejects huid with wrong length', () => {
    expect(CreateProductSchema.safeParse({ ...valid, huid: 'AB123' }).success).toBe(false);
  });

  it('rejects invalid metal', () => {
    expect(CreateProductSchema.safeParse({ ...valid, metal: 'BRONZE' }).success).toBe(false);
  });

  it('rejects invalid status', () => {
    expect(CreateProductSchema.safeParse({ ...valid, status: 'UNKNOWN' }).success).toBe(false);
  });

  it('accepts product without huid (optional)', () => {
    const { huid: _h, ...noHuid } = { ...valid };
    expect(CreateProductSchema.safeParse(noHuid).success).toBe(true);
  });
});

describe('UpdateProductSchema', () => {
  it('accepts partial update', () => {
    expect(UpdateProductSchema.safeParse({ status: 'SOLD' }).success).toBe(true);
  });

  it('rejects invalid status in partial update', () => {
    expect(UpdateProductSchema.safeParse({ status: 'GONE' }).success).toBe(false);
  });
});
