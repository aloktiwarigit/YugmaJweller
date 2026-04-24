import type { StoragePort } from '../storage.port';

export class AzureBlobAdapter implements StoragePort {
  private readonly cdnBase: string;

  constructor() {
    this.cdnBase = process.env['IMAGEKIT_CDN_BASE'] ?? 'https://ik.imagekit.io/goldsmith';
  }

  async getPresignedUploadUrl(key: string, _contentType: string): Promise<string> {
    // TODO: generate real Azure Blob SAS URL via BlobServiceClient
    return `https://stub-storage.local/${key}?sas=AZURE_STUB`;
  }

  async getPublicUrl(key: string): Promise<string> {
    return `${this.cdnBase}/${key}`;
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    // TODO: implement via BlobServiceClient when AZURE_STORAGE_CONNECTION_STRING is set
    throw new Error(`azure-blob.downloadBuffer: not implemented for key ${key}`);
  }

  async uploadBuffer(key: string, _data: Buffer, _contentType: string): Promise<void> {
    // TODO: implement via BlobServiceClient when AZURE_STORAGE_CONNECTION_STRING is set
    throw new Error(`azure-blob.uploadBuffer: not implemented for key ${key}`);
  }

  async getPresignedReadUrl(key: string): Promise<string> {
    // TODO: generate real Azure Blob SAS read URL via BlobServiceClient
    return `https://stub-storage.local/${key}?sas=AZURE_READ_STUB`;
  }
}
