import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadDataMock = vi.fn(async () => undefined);
const downloadToBufferMock = vi.fn(async () => Buffer.from('blob'));
const deleteMock = vi.fn(async () => undefined);
const generateBlobSASQueryParametersMock = vi.fn((..._args: unknown[]) => ({
  toString: () => 'sv=2024-08-04&sp=cw&se=2026-05-01T13%3A00%3A00Z',
}));

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: vi.fn(() => ({
    getContainerClient: () => ({
      getBlockBlobClient: () => ({
        uploadData: uploadDataMock,
        downloadToBuffer: downloadToBufferMock,
        delete: deleteMock,
      }),
    }),
  })),
  StorageSharedKeyCredential: vi.fn(),
  BlobSASPermissions: { parse: vi.fn((p: string) => ({ permissions: p })) },
  generateBlobSASQueryParameters: (...args: unknown[]) => generateBlobSASQueryParametersMock(...args),
}));

import { AzureBlobAdapter } from '../src/adapters/azure-blob.adapter';

describe('AzureBlobAdapter', () => {
  beforeEach(() => {
    process.env['AZURE_STORAGE_ACCOUNT'] = 'testacct';
    process.env['AZURE_STORAGE_CONTAINER'] = 'product-images';
    process.env['AZURE_STORAGE_ACCOUNT_KEY'] = 'AAAA';
    process.env['IMAGEKIT_ID'] = 'goldsmith-test';
    uploadDataMock.mockClear();
    deleteMock.mockClear();
  });

  it('uploadBuffer calls @azure/storage-blob with content-type', async () => {
    const adapter = new AzureBlobAdapter();
    await adapter.uploadBuffer('k.jpg', Buffer.from([1, 2, 3]), 'image/jpeg');
    expect(uploadDataMock).toHaveBeenCalledWith(Buffer.from([1, 2, 3]), {
      blobHTTPHeaders: { blobContentType: 'image/jpeg' },
    });
  });

  it('getPresignedUploadUrl creates a SAS with cw permissions and ~1h expiry', async () => {
    const adapter = new AzureBlobAdapter();
    const url = await adapter.getPresignedUploadUrl('tenant/x/products/y/z.jpg', 'image/jpeg');
    expect(url).toContain('https://testacct.blob.core.windows.net/product-images/tenant/x/products/y/z.jpg');
    expect(url).toContain('sp=cw');
    const call = generateBlobSASQueryParametersMock.mock.calls.at(-1)?.[0] as { expiresOn: Date; startsOn: Date };
    const ttlMs = call.expiresOn.getTime() - call.startsOn.getTime();
    expect(ttlMs).toBeGreaterThan(58 * 60_000);
    expect(ttlMs).toBeLessThan(62 * 60_000);
  });

  it('getPublicUrl returns an ImageKit URL for the same key', async () => {
    const adapter = new AzureBlobAdapter();
    const url = await adapter.getPublicUrl('tenant/x/products/y/z.jpg');
    expect(url).toBe('https://ik.imagekit.io/goldsmith-test/tenant/x/products/y/z.jpg');
  });

  it('deleteBlob is lenient on 404', async () => {
    deleteMock.mockRejectedValueOnce(Object.assign(new Error('blob not found'), { statusCode: 404 }));
    const adapter = new AzureBlobAdapter();
    await expect(adapter.deleteBlob('missing.jpg')).resolves.not.toThrow();
  });

  it('deleteBlob propagates non-404 errors', async () => {
    deleteMock.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { statusCode: 403 }));
    const adapter = new AzureBlobAdapter();
    await expect(adapter.deleteBlob('k.jpg')).rejects.toThrow('forbidden');
  });

  it('throws when required env vars are missing', () => {
    delete process.env['AZURE_STORAGE_ACCOUNT'];
    expect(() => new AzureBlobAdapter()).toThrow(/AZURE_STORAGE_ACCOUNT/);
  });
});
