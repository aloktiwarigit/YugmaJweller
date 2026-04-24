export interface StoragePort {
  getPresignedUploadUrl(key: string, contentType: string): Promise<string>;
  getPublicUrl(key: string): Promise<string>;
  downloadBuffer(key: string): Promise<Buffer>;
  uploadBuffer(key: string, data: Buffer, contentType: string): Promise<void>;
  getPresignedReadUrl(key: string): Promise<string>;
}
