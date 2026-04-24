import type { StoragePort } from '../storage.port';

export class StubStorageAdapter implements StoragePort {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPresignedUploadUrl(key: string, _contentType: string): Promise<string> {
    // TODO: wire Azure Blob SAS URL when AZURE_STORAGE_CONNECTION_STRING set
    return `https://stub-storage.local/${key}?sas=STUB`;
  }

  async getPublicUrl(key: string): Promise<string> {
    return `https://stub-storage.local/${key}`;
  }
}
