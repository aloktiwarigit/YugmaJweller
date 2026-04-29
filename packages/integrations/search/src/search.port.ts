export interface ProductSearchDoc {
  id:        string;
  sku:       string;
  metal:     string;
  purity:    string;
  huid:      string | null;
  status:    string;
  weightG:   string;   // gross_weight_g as string (DECIMAL preserves precision)
  category:  string;
  published: boolean;
  updatedAt: number;   // unix ms for Meilisearch ranking
}

export interface SearchFilters {
  metal?:      string;
  purity?:     string;
  status?:     string;
  published?:  boolean;
  weightMin?:  string;
  weightMax?:  string;
  /**
   * Performs an **exact** HUID match via Meilisearch filter DSL (no STARTS WITH support).
   * For prefix / partial HUID lookup, pass the partial value via `q` instead —
   * `huid` is included in searchableAttributes.
   */
  huidPrefix?: string;
}

export interface SearchQuery {
  q:        string;
  filters?: SearchFilters;
  limit:    number;
  offset:   number;
}

export interface SearchHit extends ProductSearchDoc {
  _score?: number;
}

export interface SearchResult {
  hits:   SearchHit[];
  total:  number;
  source: 'meilisearch' | 'postgres'; // callers use this for degraded-UX notice
}

export interface CustomerSearchDoc {
  id:         string;
  name:       string;
  phoneLast4: string;  // last 4 digits only — never full phone in search index
  city:       string | null;
  updatedAt:  number;  // unix ms
}

export interface CustomerSearchQuery {
  q:      string;
  city?:  string;
  limit:  number;
  offset: number;
}

export interface CustomerSearchHit extends CustomerSearchDoc {
  _score?: number;
}

export interface CustomerSearchResult {
  hits:   CustomerSearchHit[];
  total:  number;
  source: 'meilisearch' | 'postgres';
}

export interface SearchPort {
  indexProduct(shopId: string, product: ProductSearchDoc): Promise<void>;
  removeProduct(shopId: string, productId: string): Promise<void>;
  search(shopId: string, query: SearchQuery): Promise<SearchResult>;
  indexCustomer(shopId: string, customer: CustomerSearchDoc): Promise<void>;
  removeCustomer(shopId: string, customerId: string): Promise<void>;
  searchCustomers(shopId: string, query: CustomerSearchQuery): Promise<CustomerSearchResult>;
}

export class MeilisearchUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Meilisearch unavailable');
    this.name = 'MeilisearchUnavailableError';
    this.cause = cause;
  }
}

/** Injection token for the {@link SearchPort} provider. Single source of truth. */
export const SEARCH_PORT = 'SEARCH_PORT' as const;
