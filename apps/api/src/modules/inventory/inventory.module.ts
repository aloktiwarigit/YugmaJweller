import { Module, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { Redis } from '@goldsmith/cache';
import { Worker, TenantQueue, createTenantWorker, type JobPayload } from '@goldsmith/queue';
import { StorageModule } from '@goldsmith/integrations-storage';
import { SearchModule } from '@goldsmith/integrations-search';
import { AuthModule } from '../auth/auth.module';
import { TenantLookupModule } from '../tenant-lookup/tenant-lookup.module';
import { DrizzleTenantLookup } from '../../drizzle-tenant-lookup';
import { InventoryController } from './inventory.controller';
import { ProductImagesController } from './product-images.controller';
import { ProductImagesService } from './product-images.service';
import { ProductImagesRepository } from './product-images.repository';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import { InventoryBulkImportProcessor } from './inventory.bulk-import.processor';
import type { BulkImportJobData } from './inventory.bulk-import.processor';
import { TryOnAssetProcessor } from './try-on-asset.processor';
import type { TryOnCutoutJob } from './try-on-asset.processor';
import { InventoryBulkImportService } from './inventory.bulk-import.service';
import { InventorySearchService } from './inventory.search.service';
import { SearchIndexerProcessor } from '../../workers/search-indexer.processor';
import { BarcodeService } from './barcode.service';
import { InventoryDeadStockService } from './inventory.dead-stock.service';
import { StockMovementService } from './stock-movement.service';
import { StockMovementRepository } from './stock-movement.repository';
import { SyncModule } from '../sync/sync.module';
import { PricingModule } from '../pricing/pricing.module';
import { InventoryValuationService } from './inventory.valuation.service';
import { areQueueWorkersEnabled } from '../../queue-runtime';
import { createRedisClient } from '../../redis-client';

const QUEUE_NAME = 'inventory-bulk-import';
const TRY_ON_QUEUE_NAME = 'try-on-bg-removal';

@Module({
  imports: [
    AuthModule,
    TenantLookupModule,
    StorageModule,
    SearchModule,
    SyncModule,
    BullModule.registerQueue({ name: 'search-indexer' }),
    PricingModule,
  ],
  controllers: [InventoryController, ProductImagesController],
  exports: [InventoryService, ProductImagesRepository],
  providers: [
    ProductImagesService,
    ProductImagesRepository,
    InventoryService,
    InventoryRepository,
    BarcodeService,
    InventoryBulkImportProcessor,
    InventoryBulkImportService,
    InventorySearchService,
    InventoryDeadStockService,
    StockMovementService,
    StockMovementRepository,
    InventoryValuationService,
    SearchIndexerProcessor,
    TryOnAssetProcessor,
    {
      provide: 'INVENTORY_REDIS',
      // maxRetriesPerRequest: null is required by BullMQ Workers (blocking BZPOPMIN semantics).
      useFactory: () =>
        createRedisClient('inventory', {
          maxRetriesPerRequest: null,
        }),
    },
    {
      provide: 'BULK_IMPORT_QUEUE',
      useFactory: (redis: Redis) => new TenantQueue<BulkImportJobData>(QUEUE_NAME, redis),
      inject: ['INVENTORY_REDIS'],
    },
    {
      provide: 'TRY_ON_QUEUE',
      useFactory: (redis: Redis) => new TenantQueue<TryOnCutoutJob>(TRY_ON_QUEUE_NAME, redis),
      inject: ['INVENTORY_REDIS'],
    },
  ],
})
export class InventoryModule implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<JobPayload<BulkImportJobData>>;
  private tryOnWorker?: Worker<JobPayload<TryOnCutoutJob>>;

  constructor(
    private readonly processor: InventoryBulkImportProcessor,
    private readonly tryOnProcessor: TryOnAssetProcessor,
    @Inject('INVENTORY_REDIS') private readonly redis: Redis,
    private readonly tenants: DrizzleTenantLookup,
  ) {}

  onModuleInit(): void {
    if (!areQueueWorkersEnabled()) return;
    this.worker = createTenantWorker<BulkImportJobData>(
      QUEUE_NAME,
      (_ctx, data) => this.processor.handle(data),
      this.tenants,
      this.redis,
    );
    this.tryOnWorker = createTenantWorker<TryOnCutoutJob>(
      TRY_ON_QUEUE_NAME,
      (_ctx, data) => this.tryOnProcessor.handle(data),
      this.tenants,
      this.redis,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.tryOnWorker?.close();
    await this.redis.quit();
  }
}
