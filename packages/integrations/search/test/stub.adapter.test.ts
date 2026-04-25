import { describe, it, expect } from 'vitest';
import { StubSearchAdapter } from '../src/adapters/stub.adapter';
import { MeilisearchUnavailableError } from '../src/search.port';
import type { SearchQuery } from '../src/search.port';

const makeQuery = (overrides: Partial<SearchQuery> = {}): SearchQuery => ({
  q: 'ring',
  limit: 10,
  offset: 0,
  ...overrides,
});

describe('StubSearchAdapter', () => {
  const adapter = new StubSearchAdapter();

  it('search throws MeilisearchUnavailableError so callers fall back to Postgres', async () => {
    await expect(adapter.search('any-shop', makeQuery())).rejects.toBeInstanceOf(MeilisearchUnavailableError);
  });

  it('search throws for any query including empty q', async () => {
    await expect(
      adapter.search('any-shop', makeQuery({ q: '', filters: { metal: 'platinum' } })),
    ).rejects.toBeInstanceOf(MeilisearchUnavailableError);
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
});
