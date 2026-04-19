import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob';

export interface SasUrlResult {
  upload_url: string;
  cdn_url: string;
  blob_path: string;
  expires_at: string;
}

export interface IBlobStorageService {
  generateLogoSasUrl(shopId: string): Promise<SasUrlResult>;
}

export const BLOB_STORAGE_SERVICE = 'BLOB_STORAGE_SERVICE';

@Injectable()
export class BlobStorageService implements IBlobStorageService {
  private readonly client: BlobServiceClient;
  private readonly containerName: string;
  private readonly cdnBase: string;

  constructor() {
    const connectionString =
      process.env['AZURE_STORAGE_CONNECTION_STRING'] ?? 'UseDevelopmentStorage=true';
    this.containerName = process.env['AZURE_STORAGE_CONTAINER'] ?? 'goldsmith-assets';
    this.cdnBase =
      process.env['IMAGEKIT_CDN_BASE'] ?? 'https://ik.imagekit.io/goldsmith';
    this.client = BlobServiceClient.fromConnectionString(connectionString);
  }

  async generateLogoSasUrl(shopId: string): Promise<SasUrlResult> {
    const blobPath = `tenants/${shopId}/logo/${randomUUID()}.webp`;
    const expiresOn = new Date(Date.now() + 15 * 60 * 1000);

    const blockBlobClient = this.client
      .getContainerClient(this.containerName)
      .getBlockBlobClient(blobPath);

    const upload_url = await blockBlobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse('cw'),
      expiresOn,
      contentType: 'image/webp',
    });

    return {
      upload_url,
      cdn_url: `${this.cdnBase}/${blobPath}`,
      blob_path: blobPath,
      expires_at: expiresOn.toISOString(),
    };
  }
}
