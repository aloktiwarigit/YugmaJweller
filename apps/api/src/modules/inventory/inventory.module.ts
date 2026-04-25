import { Module, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
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
import { SearchIndexerProcessor } from '../../workers/search-indexer.processor';
import { BarcodeService } from './barcode.service';
import { InventoryDeadStockService } from './inventory.dead-stock.service';
import { StockMovementService } from './stock-movement.service';
import { StockMovementRepository } from './stock-movement.repository';
import { SyncModule } from '../sync/sync.module';

const QUEUE_NAME = 'inventory-bulk-import';

@Module({
  imports: [
    AuthModule,
    TenantLookupModule,
    StorageModule,
    SearchModule,
    SyncModule,
    BullModule.registerQueue({ name: 'search-indexer' }),
  ],
  controllers: [InventoryController],
  exports: [InventoryService],
  providers: [
    InventoryService,
    InventoryRepository,
    BarcodeService,
    InventoryBulkImportProcessor,
    InventoryBulkImportService,
    InventorySearchService,
    InventoryDeadStockService,
    StockMovementService,
    StockMovementRepository,
    SearchIndexerProcessor,
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
  ],
})
export class InventoryModule implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<JobPayload<BulkImportJobData>>;

  constructor(
    private readonly processor: InventoryBulkImportProcessor,
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
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.redis.quit();
  }
}
