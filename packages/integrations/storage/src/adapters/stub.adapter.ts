import type { StoragePort } from '../storage.port';

export class StubStorageAdapter implements StoragePort {
  private readonly blobs = new Map<string, Buffer>();

  async getPresignedUploadUrl(key: string, _contentType: string): Promise<string> {
    return `https://stub-storage.local/${key}?sas=STUB`;
  }

  async getPublicUrl(key: string): Promise<string> {
    return `https://stub-storage.local/${key}`;
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    const buf = this.blobs.get(key);
    if (!buf) throw new Error(`stub.storage: key not found: ${key}`);
    return buf;
  }

  async uploadBuffer(key: string, data: Buffer, _contentType: string): Promise<void> {
    this.blobs.set(key, data);
  }

  async getPresignedReadUrl(key: string): Promise<string> {
    return `https://stub-storage.local/${key}?sas=READ_STUB`;
  }
}
