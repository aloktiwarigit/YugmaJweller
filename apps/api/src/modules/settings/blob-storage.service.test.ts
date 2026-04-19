import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlobStorageService } from './blob-storage.service';

const SHOP_ID = '11111111-1111-1111-1111-111111111111';

const { mockGenerateSasUrl, mockBlobServiceClient } = vi.hoisted(() => {
  const mockGenerateSasUrl = vi
    .fn()
    .mockResolvedValue('https://mock.blob.core.windows.net/c/b?sas=token');
  const mockGetBlockBlobClient = vi
    .fn()
    .mockReturnValue({ generateSasUrl: mockGenerateSasUrl, url: 'https://mock.blob.core.windows.net/c/b' });
  const mockGetContainerClient = vi
    .fn()
    .mockReturnValue({ getBlockBlobClient: mockGetBlockBlobClient });
  const mockBlobServiceClient = {
    getContainerClient: mockGetContainerClient,
    accountName: 'devstoreaccount1',
  };
  return { mockGenerateSasUrl, mockBlobServiceClient };
});

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: { fromConnectionString: vi.fn().mockReturnValue(mockBlobServiceClient) },
  BlobSASPermissions: { parse: vi.fn().mockReturnValue({}) },
}));

describe('BlobStorageService', () => {
  let svc: BlobStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new BlobStorageService();
  });

  it('returns upload_url, cdn_url, blob_path, expires_at', async () => {
    mockGenerateSasUrl.mockResolvedValue('https://mock.blob.core.windows.net/c/b?sas=token');
    const result = await svc.generateLogoSasUrl(SHOP_ID);
    expect(result.upload_url).toBeTruthy();
    expect(result.cdn_url).toContain(SHOP_ID);
    expect(result.blob_path).toMatch(new RegExp(`^tenants/${SHOP_ID}/logo/.*\\.webp$`));
    expect(result.expires_at).toBeTruthy();
    expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('scopes blob path to tenant prefix', async () => {
    mockGenerateSasUrl.mockResolvedValue('https://mock.blob.core.windows.net/c/b?sas=token');
    const result = await svc.generateLogoSasUrl(SHOP_ID);
    expect(result.blob_path.startsWith(`tenants/${SHOP_ID}/logo/`)).toBe(true);
  });

  it('sets expiry 15 minutes in the future', async () => {
    mockGenerateSasUrl.mockResolvedValue('https://mock.blob.core.windows.net/c/b?sas=token');
    const before = Date.now();
    const result = await svc.generateLogoSasUrl(SHOP_ID);
    const expiresAt = new Date(result.expires_at).getTime();
    expect(expiresAt).toBeGreaterThan(before + 14 * 60 * 1000);
    expect(expiresAt).toBeLessThan(before + 16 * 60 * 1000);
  });
});
