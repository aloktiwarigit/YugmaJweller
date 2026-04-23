export interface StoragePort {
  getPresignedUploadUrl(key: string, contentType: string): Promise<string>;
  getPublicUrl(key: string): Promise<string>;
}
