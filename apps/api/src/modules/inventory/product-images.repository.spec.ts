import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductImagesRepository } from './product-images.repository';

const txMock = { query: vi.fn() };
const withTenantTxMock = vi.fn(async (_pool: unknown, fn: (tx: typeof txMock) => unknown) => fn(txMock));

vi.mock('@goldsmith/db', () => ({
  withTenantTx: (...args: unknown[]) => withTenantTxMock(...(args as [never, never])),
}));

vi.mock('@goldsmith/tenant-context', () => ({
  tenantContext: {
    requireCurrent: () => ({ shopId: 'shop-A' }),
  },
}));

describe('ProductImagesRepository', () => {
  let repo: ProductImagesRepository;

  beforeEach(() => {
    txMock.query.mockReset();
    repo = new ProductImagesRepository({} as never);
  });

  it('lockProductForTenant returns null when no row matches shop_id + product_id', async () => {
    txMock.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const r = await repo.lockProductForTenant(txMock as never, 'prod-X');
    expect(r).toBeNull();
    expect(txMock.query.mock.calls[0]?.[0]).toMatch(/SELECT id FROM products/i);
    expect(txMock.query.mock.calls[0]?.[0]).toMatch(/FOR UPDATE/i);
    // Defense-in-depth: verify shop_id is bound from tenantContext, not from a param.
    expect(txMock.query.mock.calls[0]?.[1]).toEqual(['prod-X', 'shop-A']);
  });

  it('lockProductForTenant returns id when row matches', async () => {
    txMock.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'prod-X' }] });
    const r = await repo.lockProductForTenant(txMock as never, 'prod-X');
    expect(r).toEqual({ id: 'prod-X' });
  });

  it('countImagesInTx returns the row count', async () => {
    txMock.query.mockResolvedValueOnce({ rows: [{ count: '7' }] });
    const c = await repo.countImagesInTx(txMock as never, 'prod-X');
    expect(c).toBe(7);
  });

  it('nextSortOrderInTx returns 0 when no rows exist', async () => {
    txMock.query.mockResolvedValueOnce({ rows: [{ next: 0 }] });
    const n = await repo.nextSortOrderInTx(txMock as never, 'prod-X');
    expect(n).toBe(0);
  });

  it('nextSortOrderInTx returns max+1', async () => {
    txMock.query.mockResolvedValueOnce({ rows: [{ next: 3 }] });
    const n = await repo.nextSortOrderInTx(txMock as never, 'prod-X');
    expect(n).toBe(3);
  });

  it('insertImageInTx inserts and returns the row, binding shop_id from tenantContext', async () => {
    const fakeRow = {
      id: 'img-1',
      shop_id: 'shop-A',
      product_id: 'prod-X',
      storage_key: 'k.jpg',
      mime_type: 'image/jpeg',
      byte_size: 1234,
      width: 100,
      height: 100,
      sort_order: 0,
      idempotency_key: null,
    };
    txMock.query.mockResolvedValueOnce({ rows: [fakeRow] });
    const r = await repo.insertImageInTx(txMock as never, {
      productId: 'prod-X',
      storageKey: 'k.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      width: 100,
      height: 100,
      sortOrder: 0,
      altText: null,
      uploadedByUserId: 'user-1',
      idempotencyKey: null,
    });
    expect(r.id).toBe('img-1');
    expect(txMock.query.mock.calls[0]?.[0]).toMatch(/INSERT INTO product_images/i);
    expect(txMock.query.mock.calls[0]?.[0]).toMatch(/RETURNING/i);
    // First positional binding is shop_id from tenantContext.
    expect(txMock.query.mock.calls[0]?.[1]?.[0]).toBe('shop-A');
  });

  it('findByIdempotencyKeyInTx returns null when no match', async () => {
    txMock.query.mockResolvedValueOnce({ rows: [] });
    const r = await repo.findByIdempotencyKeyInTx(txMock as never, 'prod-X', 'KEY-1');
    expect(r).toBeNull();
    expect(txMock.query.mock.calls[0]?.[0]).toMatch(/idempotency_key = \$2/i);
  });

  it('findByIdempotencyKeyInTx returns the row when present', async () => {
    txMock.query.mockResolvedValueOnce({ rows: [{ id: 'img-1' }] });
    const r = await repo.findByIdempotencyKeyInTx(txMock as never, 'prod-X', 'KEY-1');
    expect(r?.id).toBe('img-1');
  });
});
