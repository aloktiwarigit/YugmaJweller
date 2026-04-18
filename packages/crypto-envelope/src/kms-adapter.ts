export interface EncryptedDek {
  encryptedDek: Buffer;
  keyArn: string;
}

export interface KmsAdapter {
  createKeyForTenant(tenantId: string): Promise<string>;
  generateDataKey(keyArn: string): Promise<{ plaintext: Buffer; encryptedDek: Buffer }>;
  decryptDataKey(encryptedDek: Buffer, keyArn: string): Promise<Buffer>;
  scheduleKeyDeletion(keyArn: string, pendingDays?: number): Promise<void>;
}
