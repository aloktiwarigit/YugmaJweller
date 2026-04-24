import { Module, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { Worker } from '@goldsmith/queue';
import { Redis } from '@goldsmith/cache';
import { TenantQueue, createTenantWorker } from '@goldsmith/queue';
import type { JobPayload } from '@goldsmith/queue';
import { StorageModule } from '@goldsmith/integrations-storage';
import { SearchModule } from '@goldsmith/integrations-search';
import { AuthModule } from '../auth/auth.module';
import { TenantLookupModule } from '../tenant-lookup/tenant-lookup.module';
import { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import { InventoryBulkImportProcessor } from './inventory.bulk-import.processor';
import type { BulkImportJobData } from './inventory.bulk-import.processor';
import { InventoryBulkImportService } from './inventory.bulk-import.service';
import { InventorySearchService } from './inventory.search.service';
import type { SearchIndexerJobData } from '../../workers/search-indexer.processor';
import { BarcodeService } from './barcode.service';
import { SyncModule } from '../sync/sync.module';

const QUEUE_NAME = 'inventory-bulk-import';
const SEARCH_INDEXER_QUEUE_NAME = 'search-indexer';

@Module({
  imports: [AuthModule, TenantLookupModule, StorageModule, SearchModule, SyncModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryRepository,
    BarcodeService,
    InventoryBulkImportProcessor,
    InventoryBulkImportService,
    InventorySearchService,
    {
      provide: 'INVENTORY_REDIS',
      // maxRetriesPerRequest: null is required by BullMQ Workers (blocking BZPOPMIN semantics).
      useFactory: () =>
        new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
        }),
    },
    {
      provide: 'BULK_IMPORT_QUEUE',
      useFactory: (redis: Redis) => new TenantQueue<BulkImportJobData>(QUEUE_NAME, redis),
      inject: ['INVENTORY_REDIS'],
    },
    {
      provide: 'SEARCH_INDEXER_QUEUE',
      useFactory: (redis: Redis) =>
        new TenantQueue<SearchIndexerJobData>(SEARCH_INDEXER_QUEUE_NAME, redis),
      inject: ['INVENTORY_REDIS'],
    },
  ],
})
export class InventoryModule implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<JobPayload<BulkImportJobData>>;
  private searchWorker?: Worker<JobPayload<SearchIndexerJobData>>;

  constructor(
    private readonly processor: InventoryBulkImportProcessor,
    private readonly inventorySearchService: InventorySearchService,
    @Inject('INVENTORY_REDIS') private readonly redis: Redis,
    private readonly tenants: DrizzleTenantLookup,
  ) {}

  onModuleInit(): void {
    this.worker = createTenantWorker<BulkImportJobData>(
      QUEUE_NAME,
      (_ctx, data) => this.processor.handle(data),
      this.tenants,
      this.redis,
    );
    this.searchWorker = createTenantWorker<SearchIndexerJobData>(
      SEARCH_INDEXER_QUEUE_NAME,
      (_ctx, data) =>
        data.operation === 'index'
          ? this.inventorySearchService.indexProduct(data.shopId, data.productId)
          : this.inventorySearchService.removeFromIndex(data.shopId, data.productId),
      this.tenants,
      this.redis,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.worker?.close(), this.searchWorker?.close()]);
    await this.redis.quit();
  }
}
