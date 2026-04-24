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

export interface SearchPort {
  indexProduct(shopId: string, product: ProductSearchDoc): Promise<void>;
  removeProduct(shopId: string, productId: string): Promise<void>;
  search(shopId: string, query: SearchQuery): Promise<SearchResult>;
}

export class MeilisearchUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Meilisearch unavailable');
    this.name = 'MeilisearchUnavailableError';
    this.cause = cause;
  }
}
