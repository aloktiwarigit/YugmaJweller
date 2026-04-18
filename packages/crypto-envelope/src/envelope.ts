import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { KmsAdapter } from './kms-adapter';

export interface EnvelopeCiphertext {
  ciphertext: Buffer;
  encryptedDek: Buffer;
  iv: Buffer;
  tag: Buffer;
  keyArn: string;
}

export async function encryptColumn(
  kms: KmsAdapter,
  keyArn: string,
  plaintext: string,
): Promise<EnvelopeCiphertext> {
  const { plaintext: dek, encryptedDek } = await kms.generateDataKey(keyArn);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  dek.fill(0);
  return { ciphertext: ct, encryptedDek, iv, tag, keyArn };
}

export async function decryptColumn(kms: KmsAdapter, payload: EnvelopeCiphertext): Promise<string> {
  const dek = await kms.decryptDataKey(payload.encryptedDek, payload.keyArn);
  const decipher = createDecipheriv('aes-256-gcm', dek, payload.iv);
  decipher.setAuthTag(payload.tag);
  const plain = Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
  dek.fill(0);
  return plain.toString('utf8');
}
