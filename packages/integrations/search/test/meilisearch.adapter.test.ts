import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MeilisearchAdapter } from '../src/adapters/meilisearch.adapter';
import { MeilisearchUnavailableError } from '../src/search.port';
import type { ProductSearchDoc, SearchQuery } from '../src/search.port';

// ── Mock the meilisearch npm package ─────────────────────────────────────────

const mockUpdateSettings = vi.fn().mockResolvedValue({ taskUid: 1 });
const mockWaitForTask = vi.fn().mockResolvedValue(undefined);
const mockAddDocuments = vi.fn().mockResolvedValue({ taskUid: 2 });
const mockDeleteDocument = vi.fn().mockResolvedValue({ taskUid: 3 });
const mockSearch = vi.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0 });
const mockGetIndex = vi.fn();
const mockCreateIndex = vi.fn();

vi.mock('meilisearch', () => {
  return {
    MeiliSearch: vi.fn().mockImplementation(() => ({
      getIndex: mockGetIndex,
      createIndex: mockCreateIndex,
      waitForTask: mockWaitForTask,
    })),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeDoc = (overrides: Partial<ProductSearchDoc> = {}): ProductSearchDoc => ({
  id: 'prod-123',
  sku: 'SKU-001',
  metal: 'gold',
  purity: '22K',
  huid: 'AB1234',
  status: 'available',
  weightG: '5.2500',
  category: 'ring',
  published: true,
  updatedAt: 1714000000000,
  ...overrides,
});

const makeQuery = (overrides: Partial<SearchQuery> = {}): SearchQuery => ({
  q: 'ring',
  limit: 10,
  offset: 0,
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MeilisearchAdapter', () => {
  let adapter: MeilisearchAdapter;
  let indexMock: {
    updateSettings: typeof mockUpdateSettings;
    addDocuments: typeof mockAddDocuments;
    deleteDocument: typeof mockDeleteDocument;
    search: typeof mockSearch;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    indexMock = {
      updateSettings: mockUpdateSettings,
      addDocuments: mockAddDocuments,
      deleteDocument: mockDeleteDocument,
      search: mockSearch,
    };

    // getIndex succeeds (index already exists)
    mockGetIndex.mockResolvedValue(indexMock);

    adapter = new MeilisearchAdapter('http://localhost:7700', 'masterKey');
  });

  // ── Index naming ────────────────────────────────────────────────────────────

  it('uses hyphen-free index name for a shop UUID', async () => {
    const shopId = 'abc-def-123';
    await adapter.indexProduct(shopId, makeDoc());

    // getIndex called with underscored name
    expect(mockGetIndex).toHaveBeenCalledWith('shop_abc_def_123_products');
  });

  it('uses correct index for shop_a and does NOT call shop_b index', async () => {
    const shopA = 'shop-a';
    const shopB = 'shop-b';

    await adapter.indexProduct(shopA, makeDoc());
    expect(mockGetIndex).toHaveBeenCalledWith('shop_shop_a_products');
    expect(mockGetIndex).not.toHaveBeenCalledWith('shop_shop_b_products');

    vi.clearAllMocks();
    mockGetIndex.mockResolvedValue(indexMock);

    await adapter.search(shopB, makeQuery());
    expect(mockGetIndex).toHaveBeenCalledWith('shop_shop_b_products');
    expect(mockGetIndex).not.toHaveBeenCalledWith('shop_shop_a_products');
  });

  // ── indexProduct ────────────────────────────────────────────────────────────

  it('indexProduct calls addDocuments with the doc', async () => {
    const doc = makeDoc();
    await adapter.indexProduct('shop-1', doc);
    expect(mockAddDocuments).toHaveBeenCalledWith([doc]);
  });

  it('indexProduct wraps Meilisearch errors as MeilisearchUnavailableError', async () => {
    mockAddDocuments.mockRejectedValueOnce(new Error('network error'));
    await expect(adapter.indexProduct('shop-1', makeDoc())).rejects.toThrow(
      MeilisearchUnavailableError,
    );
  });

  // ── removeProduct ───────────────────────────────────────────────────────────

  it('removeProduct calls deleteDocument with productId', async () => {
    await adapter.removeProduct('shop-1', 'prod-456');
    expect(mockDeleteDocument).toHaveBeenCalledWith('prod-456');
  });

  it('removeProduct wraps errors as MeilisearchUnavailableError', async () => {
    mockDeleteDocument.mockRejectedValueOnce(new Error('timeout'));
    await expect(adapter.removeProduct('shop-1', 'prod-456')).rejects.toThrow(
      MeilisearchUnavailableError,
    );
  });

  // ── search ──────────────────────────────────────────────────────────────────

  it('search returns hits and total from meilisearch response', async () => {
    const hit = { ...makeDoc(), _score: 0.9 };
    mockSearch.mockResolvedValueOnce({ hits: [hit], estimatedTotalHits: 1 });

    const result = await adapter.search('shop-1', makeQuery());
    expect(result.hits).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.source).toBe('meilisearch');
  });

  it('search passes q, limit, offset to the index', async () => {
    const query = makeQuery({ q: 'मंगलसूत्र', limit: 20, offset: 40 });
    await adapter.search('shop-1', query);
    expect(mockSearch).toHaveBeenCalledWith(
      'मंगलसूत्र',
      expect.objectContaining({ limit: 20, offset: 40 }),
    );
  });

  it('search builds filter string for metal + status filters', async () => {
    const query = makeQuery({
      filters: { metal: 'gold', status: 'available' },
    });
    await adapter.search('shop-1', query);
    const callArgs = mockSearch.mock.calls[0];
    expect(callArgs).toBeDefined();
    const opts = callArgs![1] as { filter?: string };
    expect(opts.filter).toContain('metal = "gold"');
    expect(opts.filter).toContain('status = "available"');
  });

  it('search builds weight range filter when weightMin/Max provided', async () => {
    const query = makeQuery({
      filters: { weightMin: '1.0000', weightMax: '5.0000' },
    });
    await adapter.search('shop-1', query);
    const callArgs = mockSearch.mock.calls[0];
    expect(callArgs).toBeDefined();
    const opts = callArgs![1] as { filter?: string };
    expect(opts.filter).toContain('weightG');
  });

  it('search wraps errors as MeilisearchUnavailableError', async () => {
    mockSearch.mockRejectedValueOnce(new Error('503'));
    await expect(adapter.search('shop-1', makeQuery())).rejects.toThrow(
      MeilisearchUnavailableError,
    );
  });

  // ── ensureIndex caching ─────────────────────────────────────────────────────

  it('ensureIndex is called only once per shopId (caches configured indexes)', async () => {
    // Call indexProduct twice for the same shop
    await adapter.indexProduct('shop-1', makeDoc());
    await adapter.indexProduct('shop-1', makeDoc({ id: 'prod-999' }));

    // updateSettings (called inside ensureIndex) should have been called once
    expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
  });

  // ── ensureIndex fallback: creates index when not found ──────────────────────

  it('ensureIndex creates index when getIndex returns 404', async () => {
    const notFoundErr = Object.assign(new Error('Index not found'), { code: 'index_not_found' });
    mockGetIndex.mockRejectedValueOnce(notFoundErr);
    mockCreateIndex.mockResolvedValueOnce({ taskUid: 10 });
    // After creation, getIndex succeeds
    mockGetIndex.mockResolvedValueOnce(indexMock);

    await adapter.indexProduct('shop-new', makeDoc());
    expect(mockCreateIndex).toHaveBeenCalledWith('shop_shop_new_products', { primaryKey: 'id' });
  });

  // ── Tenant isolation ────────────────────────────────────────────────────────

  it('tenant isolation: search for shop_B never touches shop_A index', async () => {
    // Index shop_A first
    await adapter.indexProduct('shop-a', makeDoc());
    vi.clearAllMocks();
    mockGetIndex.mockResolvedValue(indexMock);

    // Now search shop_B
    await adapter.search('shop-b', makeQuery());

    // Only shop_B index referenced
    expect(mockGetIndex).toHaveBeenCalledWith('shop_shop_b_products');
    expect(mockGetIndex).not.toHaveBeenCalledWith('shop_shop_a_products');
  });
});
