import { Module } from '@nestjs/common';
import type { StoragePort } from './storage.port';
import { StubStorageAdapter } from './adapters/stub.adapter';
import { AzureBlobAdapter } from './adapters/azure-blob.adapter';
import { ImageKitAdapter } from './adapters/imagekit.adapter';

export const STORAGE_PORT = 'STORAGE_PORT';

@Module({
  providers: [
    {
      provide: STORAGE_PORT,
      useFactory: (): StoragePort => {
        const adapter = process.env['STORAGE_ADAPTER'] ?? 'stub';
        switch (adapter) {
          case 'azure': return new AzureBlobAdapter();
          case 'imagekit': return new ImageKitAdapter();
          default: return new StubStorageAdapter();
        }
      },
    },
  ],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
