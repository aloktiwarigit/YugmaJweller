import type { StoragePort } from '../storage.port';

export class ImageKitAdapter implements StoragePort {
  private readonly base: string;

  constructor() {
    this.base = process.env['IMAGEKIT_CDN_BASE'] ?? 'https://ik.imagekit.io/goldsmith';
  }

  async getPresignedUploadUrl(key: string, _contentType: string): Promise<string> {
    // TODO: generate real ImageKit upload URL when credentials are set
    return `${this.base}/${key}?upload=STUB`;
  }

  async getPublicUrl(key: string): Promise<string> {
    return `${this.base}/${key}`;
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    // TODO: implement via ImageKit download API
    throw new Error(`imagekit.downloadBuffer: not implemented for key ${key}`);
  }

  async uploadBuffer(key: string, _data: Buffer, _contentType: string): Promise<void> {
    // TODO: implement via ImageKit upload API
    throw new Error(`imagekit.uploadBuffer: not implemented for key ${key}`);
  }

  async getPresignedReadUrl(key: string): Promise<string> {
    return `${this.base}/${key}`;
  }
}
