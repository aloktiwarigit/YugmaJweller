import { MeiliSearch } from 'meilisearch';
import type { Index } from 'meilisearch';
import type {
  SearchPort,
  ProductSearchDoc,
  SearchQuery,
  SearchResult,
  SearchHit,
  SearchFilters,
  CustomerSearchDoc,
  CustomerSearchQuery,
  CustomerSearchResult,
  CustomerSearchHit,
} from '../search.port';
import { MeilisearchUnavailableError } from '../search.port';

// Hindi ↔ English synonyms for jewellery terms
const JEWELLERY_SYNONYMS: Record<string, string[]> = {
  mangalsutra:   ['मंगलसूत्र'],
  ring:          ['अंगूठी'],
  chain:         ['चेन'],
  'मंगलसूत्र': ['mangalsutra'],
  'अंगूठी':     ['ring'],
  'चेन':         ['chain'],
};

// Hindi ↔ English transliterations for common Indian customer names
const CUSTOMER_NAME_SYNONYMS: Record<string, string[]> = {
  priya:     ['प्रिया'],
  ramesh:    ['रमेश'],
  sunita:    ['सुनीता'],
  suresh:    ['सुरेश'],
  geeta:     ['गीता'],
  kavita:    ['कविता'],
  'प्रिया': ['priya'],
  'रमेश':   ['ramesh'],
  'सुनीता': ['sunita'],
  'सुरेश':  ['suresh'],
  'गीता':   ['geeta'],
  'कविता':  ['kavita'],
};

export class MeilisearchAdapter implements SearchPort {
  private readonly client: MeiliSearch;
  /** Tracks which indexes have already been configured to avoid repeated updateSettings calls. */
  private readonly configuredIndexes = new Set<string>();

  constructor(url: string, apiKey: string) {
    this.client = new MeiliSearch({ host: url, apiKey });
  }

  // ── Index names ─────────────────────────────────────────────────────────────

  private indexName(shopId: string): string {
    return `shop_${shopId.replace(/-/g, '_')}_products`;
  }

  private customerIndexName(shopId: string): string {
    return `shop_${shopId.replace(/-/g, '_')}_customers`;
  }

  // ── ensureIndex ─────────────────────────────────────────────────────────────

  /**
   * Idempotently creates and configures the per-tenant product index.
   * Results are cached on the instance — a second call for the same shopId is a no-op.
   */
  private async ensureIndex(shopId: string): Promise<Index> {
    const name = this.indexName(shopId);

    let index: Index;
    try {
      index = await this.client.getIndex(name);
    } catch (err) {
      // Index does not exist yet — create it
      const task = await this.client.createIndex(name, { primaryKey: 'id' });
      await this.client.waitForTask(task.taskUid);
      index = await this.client.getIndex(name);
    }

    if (!this.configuredIndexes.has(name)) {
      await index.updateSettings({
        searchableAttributes: ['sku', 'huid', 'metal', 'purity', 'category'],
        filterableAttributes: ['metal', 'purity', 'status', 'published', 'weightG'],
        sortableAttributes:   ['updatedAt'],
        synonyms:             JEWELLERY_SYNONYMS,
      });
      this.configuredIndexes.add(name);
    }

    return index;
  }

  private async ensureCustomerIndex(shopId: string): Promise<Index> {
    const name = this.customerIndexName(shopId);

    let index: Index;
    try {
      index = await this.client.getIndex(name);
    } catch {
      const task = await this.client.createIndex(name, { primaryKey: 'id' });
      await this.client.waitForTask(task.taskUid);
      index = await this.client.getIndex(name);
    }

    if (!this.configuredIndexes.has(name)) {
      await index.updateSettings({
        searchableAttributes: ['name', 'phoneLast4', 'city'],
        filterableAttributes: ['city'],
        sortableAttributes:   ['updatedAt'],
        synonyms:             CUSTOMER_NAME_SYNONYMS,
      });
      this.configuredIndexes.add(name);
    }

    return index;
  }

  // ── Product SearchPort implementation ───────────────────────────────────────

  async indexProduct(shopId: string, product: ProductSearchDoc): Promise<void> {
    try {
      const index = await this.ensureIndex(shopId);
      await index.addDocuments([product]);
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) throw err;
      throw new MeilisearchUnavailableError(err);
    }
  }

  async removeProduct(shopId: string, productId: string): Promise<void> {
    try {
      const index = await this.ensureIndex(shopId);
      await index.deleteDocument(productId);
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) throw err;
      throw new MeilisearchUnavailableError(err);
    }
  }

  async search(shopId: string, query: SearchQuery): Promise<SearchResult> {
    try {
      const index = await this.ensureIndex(shopId);
      const filter = buildFilterString(query.filters);

      const searchParams = filter !== null
        ? { filter, limit: query.limit, offset: query.offset }
        : { limit: query.limit, offset: query.offset };

      const response = await index.search(query.q, searchParams);

      return {
        hits:   response.hits as SearchHit[],
        total:  response.estimatedTotalHits ?? 0,
        source: 'meilisearch',
      };
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) throw err;
      throw new MeilisearchUnavailableError(err);
    }
  }

  // ── Customer SearchPort implementation ──────────────────────────────────────

  async indexCustomer(shopId: string, customer: CustomerSearchDoc): Promise<void> {
    try {
      const index = await this.ensureCustomerIndex(shopId);
      await index.addDocuments([customer]);
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) throw err;
      throw new MeilisearchUnavailableError(err);
    }
  }

  async removeCustomer(shopId: string, customerId: string): Promise<void> {
    try {
      const index = await this.ensureCustomerIndex(shopId);
      await index.deleteDocument(customerId);
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) throw err;
      throw new MeilisearchUnavailableError(err);
    }
  }

  async searchCustomers(shopId: string, query: CustomerSearchQuery): Promise<CustomerSearchResult> {
    try {
      const index = await this.ensureCustomerIndex(shopId);
      const filter = query.city ? `city = "${query.city}"` : undefined;

      const searchParams = {
        limit:  query.limit,
        offset: query.offset,
        ...(filter !== undefined ? { filter } : {}),
      };

      const response = await index.search(query.q, searchParams);

      return {
        hits:   response.hits as CustomerSearchHit[],
        total:  response.estimatedTotalHits ?? 0,
        source: 'meilisearch',
      };
    } catch (err) {
      if (err instanceof MeilisearchUnavailableError) throw err;
      throw new MeilisearchUnavailableError(err);
    }
  }
}

// ── Filter builder ────────────────────────────────────────────────────────────

/**
 * Builds a Meilisearch filter expression string from {@link SearchFilters}.
 *
 * Weight range uses string comparison (`weightG >= "x" AND weightG <= "y"`).
 * This is approximate for string-encoded decimals — callers should be aware that
 * lexicographic ordering only matches numeric ordering when both sides have the
 * same number of digits. For MVP inventory counts (< 1 000 items per shop) this
 * is acceptable; exact numeric filtering can be added when Meilisearch adds
 * native decimal support.
 */
function buildFilterString(filters?: SearchFilters): string | null {
  if (!filters) return null;

  const parts: string[] = [];

  if (filters.metal !== undefined)     parts.push(`metal = "${filters.metal}"`);
  if (filters.purity !== undefined)    parts.push(`purity = "${filters.purity}"`);
  if (filters.status !== undefined)    parts.push(`status = "${filters.status}"`);
  if (filters.published !== undefined) parts.push(`published = ${String(filters.published)}`);
  // Meilisearch filter DSL has no STARTS WITH — huidPrefix matches exact value.
  // For partial HUID lookup, use the q field (searchableAttributes includes 'huid').
  if (filters.huidPrefix !== undefined) parts.push(`huid = "${filters.huidPrefix}"`);

  if (filters.weightMin !== undefined) parts.push(`weightG >= "${filters.weightMin}"`);
  if (filters.weightMax !== undefined) parts.push(`weightG <= "${filters.weightMax}"`);

  return parts.length > 0 ? parts.join(' AND ') : null;
}
