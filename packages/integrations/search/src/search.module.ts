import { Module } from '@nestjs/common';
import type { SearchPort } from './search.port';
import { SEARCH_PORT } from './search.port';
import { StubSearchAdapter } from './adapters/stub.adapter';
import { MeilisearchAdapter } from './adapters/meilisearch.adapter';

@Module({
  providers: [
    {
      provide: SEARCH_PORT,
      useFactory: (): SearchPort => {
        const url    = process.env['MEILISEARCH_URL'];
        const apiKey = process.env['MEILISEARCH_API_KEY'] ?? '';
        if (url) {
          return new MeilisearchAdapter(url, apiKey);
        }
        return new StubSearchAdapter();
      },
    },
  ],
  exports: [SEARCH_PORT],
})
export class SearchModule {}
