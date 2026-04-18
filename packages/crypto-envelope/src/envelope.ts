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
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dek, iv);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext, encryptedDek, iv, tag, keyArn };
  } finally {
    dek.fill(0);
  }
}

export async function decryptColumn(kms: KmsAdapter, payload: EnvelopeCiphertext): Promise<string> {
  const dek = await kms.decryptDataKey(payload.encryptedDek, payload.keyArn);
  try {
    const decipher = createDecipheriv('aes-256-gcm', dek, payload.iv);
    decipher.setAuthTag(payload.tag);
    const plain = Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
    try {
      return plain.toString('utf8');
    } finally {
      plain.fill(0);
    }
  } finally {
    dek.fill(0);
  }
}
