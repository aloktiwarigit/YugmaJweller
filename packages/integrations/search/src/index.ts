export type {
  SearchPort,
  ProductSearchDoc,
  SearchQuery,
  SearchResult,
  SearchHit,
  SearchFilters,
} from './search.port';
export { MeilisearchUnavailableError, SEARCH_PORT } from './search.port';
export { StubSearchAdapter } from './adapters/stub.adapter';
export { MeilisearchAdapter } from './adapters/meilisearch.adapter';
export { SearchModule } from './search.module';
