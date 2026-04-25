import { hkdfSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { KmsAdapter } from './kms-adapter';

/**
 * Deterministic dev/MVP KMS adapter.
 *
 * Keys are derived via HKDF(masterSecret, info=keyArn) so decryption survives
 * process restarts without an external KMS. The master secret MUST be kept stable
 * across restarts (set KMS_MASTER_SECRET env var).
 *
 * For production: replace with an Azure Key Vault adapter.
 */
export class DevKmsAdapter implements KmsAdapter {
  private readonly masterKey: Buffer;

  constructor(masterSecret: string) {
    this.masterKey = Buffer.from(
      hkdfSync('sha256', Buffer.from(masterSecret, 'utf8'), '', 'goldsmith-dev-kms-v1', 32),
    );
  }

  async createKeyForTenant(tenantId: string): Promise<string> {
    // ARN encodes tenant so it is stored in shops.kek_key_arn and re-used on restart.
    // A random suffix makes key rotation possible (new ARN → new derived key).
    return `devkms:${tenantId}:${randomBytes(8).toString('hex')}`;
  }

  private deriveKek(keyArn: string): Buffer {
    return Buffer.from(hkdfSync('sha256', this.masterKey, '', keyArn, 32));
  }

  async generateDataKey(keyArn: string): Promise<{ plaintext: Buffer; encryptedDek: Buffer }> {
    const kek = this.deriveKek(keyArn);
    const plaintext = randomBytes(32);
    const iv = randomBytes(12);
    try {
      const cipher = createCipheriv('aes-256-gcm', kek, iv);
      const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();
      return { plaintext, encryptedDek: Buffer.concat([iv, tag, ct]) };
    } finally {
      kek.fill(0);
    }
  }

  async decryptDataKey(encryptedDek: Buffer, keyArn: string): Promise<Buffer> {
    const kek = this.deriveKek(keyArn);
    try {
      const iv = encryptedDek.subarray(0, 12);
      const tag = encryptedDek.subarray(12, 28);
      const ct = encryptedDek.subarray(28);
      const decipher = createDecipheriv('aes-256-gcm', kek, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]);
    } finally {
      kek.fill(0);
    }
  }

  async scheduleKeyDeletion(_keyArn: string): Promise<void> {
    // No-op: derived keys cannot be deleted; rotate by issuing a new ARN.
  }
}
