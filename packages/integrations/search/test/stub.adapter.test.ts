import { describe, it, expect } from 'vitest';
import { StubSearchAdapter } from '../src/adapters/stub.adapter';
import type { SearchQuery } from '../src/search.port';

const makeQuery = (overrides: Partial<SearchQuery> = {}): SearchQuery => ({
  q: 'ring',
  limit: 10,
  offset: 0,
  ...overrides,
});

describe('StubSearchAdapter', () => {
  const adapter = new StubSearchAdapter();

  it('search returns empty hits and total 0', async () => {
    const result = await adapter.search('any-shop', makeQuery());
    expect(result.hits).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('search returns source meilisearch (no degraded-UX notice for stub)', async () => {
    const result = await adapter.search('any-shop', makeQuery());
    expect(result.source).toBe('meilisearch');
  });

  it('indexProduct does not throw', async () => {
    await expect(
      adapter.indexProduct('any-shop', {
        id: 'prod-1',
        sku: 'SKU-001',
        metal: 'gold',
        purity: '22K',
        huid: null,
        status: 'available',
        weightG: '5.0000',
        category: 'ring',
        published: true,
        updatedAt: 1714000000000,
      }),
    ).resolves.toBeUndefined();
  });

  it('removeProduct does not throw', async () => {
    await expect(adapter.removeProduct('any-shop', 'prod-1')).resolves.toBeUndefined();
  });

  it('search never throws for any query', async () => {
    await expect(
      adapter.search('any-shop', makeQuery({ q: '', filters: { metal: 'platinum' } })),
    ).resolves.toBeDefined();
  });
});
