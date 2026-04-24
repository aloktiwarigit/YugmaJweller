import { describe, it, expect } from 'vitest';
import { StubStorageAdapter } from '../src/adapters/stub.adapter';
import { AzureBlobAdapter } from '../src/adapters/azure-blob.adapter';
import { ImageKitAdapter } from '../src/adapters/imagekit.adapter';

describe('StubStorageAdapter', () => {
  const adapter = new StubStorageAdapter();

  it('getPresignedUploadUrl returns a stub URL containing the key', async () => {
    const url = await adapter.getPresignedUploadUrl('tenants/abc/logo.webp', 'image/webp');
    expect(url).toContain('tenants/abc/logo.webp');
    expect(url).toContain('stub-storage.local');
  });

  it('getPublicUrl returns a URL containing the key', async () => {
    const url = await adapter.getPublicUrl('tenants/abc/logo.webp');
    expect(url).toContain('tenants/abc/logo.webp');
  });
});

describe('AzureBlobAdapter', () => {
  const adapter = new AzureBlobAdapter();

  it('getPresignedUploadUrl returns stub URL (no credentials configured)', async () => {
    const url = await adapter.getPresignedUploadUrl('tenants/abc/test.jpg', 'image/jpeg');
    expect(url).toContain('tenants/abc/test.jpg');
  });
});

describe('ImageKitAdapter', () => {
  const adapter = new ImageKitAdapter();

  it('getPresignedUploadUrl returns stub URL', async () => {
    const url = await adapter.getPresignedUploadUrl('tenants/abc/test.jpg', 'image/jpeg');
    expect(url).toContain('tenants/abc/test.jpg');
  });
});
