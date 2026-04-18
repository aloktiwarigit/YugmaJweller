import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { KmsAdapter } from './kms-adapter';

interface StoredKey { keyMaterial: Buffer; deleted: boolean; }

export class LocalKMS implements KmsAdapter {
  private keys = new Map<string, StoredKey>();

  async createKeyForTenant(tenantId: string): Promise<string> {
    const arn = `local:kms:${tenantId}:${randomBytes(8).toString('hex')}`;
    this.keys.set(arn, { keyMaterial: randomBytes(32), deleted: false });
    return arn;
  }

  async generateDataKey(keyArn: string): Promise<{ plaintext: Buffer; encryptedDek: Buffer }> {
    const kek = this.keys.get(keyArn);
    if (!kek || kek.deleted) throw new Error('key.unavailable');
    const plaintext = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', kek.keyMaterial, iv);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { plaintext, encryptedDek: Buffer.concat([iv, tag, ct]) };
  }

  async decryptDataKey(encryptedDek: Buffer, keyArn: string): Promise<Buffer> {
    const kek = this.keys.get(keyArn);
    if (!kek || kek.deleted) throw new Error('key.unavailable');
    const iv = encryptedDek.subarray(0, 12);
    const tag = encryptedDek.subarray(12, 28);
    const ct = encryptedDek.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', kek.keyMaterial, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  async scheduleKeyDeletion(keyArn: string): Promise<void> {
    const k = this.keys.get(keyArn);
    if (k) k.deleted = true;
  }
}
