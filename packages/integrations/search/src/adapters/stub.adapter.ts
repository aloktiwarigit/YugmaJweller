import type {
  SearchPort,
  ProductSearchDoc,
  SearchQuery,
  SearchResult,
  CustomerSearchDoc,
  CustomerSearchQuery,
  CustomerSearchResult,
} from '../search.port';
import { MeilisearchUnavailableError } from '../search.port';

export class StubSearchAdapter implements SearchPort {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async indexProduct(_shopId: string, _product: ProductSearchDoc): Promise<void> {
    console.warn('StubSearchAdapter: Meilisearch not configured, skipping index');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async removeProduct(_shopId: string, _productId: string): Promise<void> {
    console.warn('StubSearchAdapter: Meilisearch not configured, skipping remove');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(_shopId: string, _query: SearchQuery): Promise<SearchResult> {
    // Throw so InventorySearchService falls back to Postgres automatically.
    // MEILISEARCH_URL is not configured — treat as unavailable, not as "no results".
    throw new MeilisearchUnavailableError('MEILISEARCH_URL not configured');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async indexCustomer(_shopId: string, _customer: CustomerSearchDoc): Promise<void> {
    console.warn('StubSearchAdapter: Meilisearch not configured, skipping customer index');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async removeCustomer(_shopId: string, _customerId: string): Promise<void> {
    console.warn('StubSearchAdapter: Meilisearch not configured, skipping customer remove');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async searchCustomers(_shopId: string, _query: CustomerSearchQuery): Promise<CustomerSearchResult> {
    throw new MeilisearchUnavailableError('MEILISEARCH_URL not configured');
  }
}
