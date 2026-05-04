import { Module } from '@nestjs/common';
import type { StoragePort } from './storage.port';
import type { MalwareScanPort } from './malware-scan.port';
import { MALWARE_SCAN_PORT } from './malware-scan.port';
import { StubStorageAdapter } from './adapters/stub.adapter';
import { AzureBlobAdapter } from './adapters/azure-blob.adapter';
import { StubMalwareScanAdapter } from './adapters/stub-malware-scan.adapter';
import { ImageKitTransformUrlBuilder, IMAGEKIT_URL_BUILDER } from './adapters/imagekit-url-builder';

export const STORAGE_PORT = 'STORAGE_PORT';

@Module({
  providers: [
    {
      provide: STORAGE_PORT,
      useFactory: (): StoragePort => {
        const adapter = process.env['STORAGE_ADAPTER'] ?? 'stub';
        switch (adapter) {
          case 'azure-imagekit': return new AzureBlobAdapter();
          case 'stub':           return new StubStorageAdapter();
          default:
            throw new Error(`Unknown STORAGE_ADAPTER: ${adapter}`);
        }
      },
    },
    {
      provide: MALWARE_SCAN_PORT,
      useFactory: (): MalwareScanPort => new StubMalwareScanAdapter(),
    },
    {
      provide: IMAGEKIT_URL_BUILDER,
      useFactory: () => new ImageKitTransformUrlBuilder(),
    },
  ],
  exports: [STORAGE_PORT, MALWARE_SCAN_PORT, IMAGEKIT_URL_BUILDER],
})
export class StorageModule {}
