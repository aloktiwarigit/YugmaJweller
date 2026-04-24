import type { StoragePort } from '../storage.port';

export class AzureBlobAdapter implements StoragePort {
  private readonly cdnBase: string;

  constructor() {
    // TODO: wire BlobServiceClient when AZURE_STORAGE_CONNECTION_STRING is set
    this.cdnBase = process.env['IMAGEKIT_CDN_BASE'] ?? 'https://ik.imagekit.io/goldsmith';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPresignedUploadUrl(key: string, _contentType: string): Promise<string> {
    // TODO: generate real Azure Blob SAS URL via BlobServiceClient
    return `https://stub-storage.local/${key}?sas=AZURE_STUB`;
  }

  async getPublicUrl(key: string): Promise<string> {
    return `${this.cdnBase}/${key}`;
  }
}
