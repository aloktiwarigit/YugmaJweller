import { describe, it, expect } from 'vitest';
import { LocalKMS } from '../src/local-kms';
import { encryptColumn, decryptColumn } from '../src/envelope';

describe('envelope encryption (LocalKMS)', () => {
  it('round-trips plaintext through encrypt + decrypt', async () => {
    const kms = new LocalKMS();
    const arn = await kms.createKeyForTenant('tenant-a');
    const enc = await encryptColumn(kms, arn, 'hello');
    expect(enc.ciphertext).not.toEqual(Buffer.from('hello', 'utf8'));
    expect(await decryptColumn(kms, enc)).toBe('hello');
  });

  it('ciphertext for same plaintext differs (IV randomness)', async () => {
    const kms = new LocalKMS();
    const arn = await kms.createKeyForTenant('tenant-a');
    const a = await encryptColumn(kms, arn, 'x');
    const b = await encryptColumn(kms, arn, 'x');
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it('KEK deletion prevents decryption', async () => {
    const kms = new LocalKMS();
    const arn = await kms.createKeyForTenant('tenant-b');
    const enc = await encryptColumn(kms, arn, 'secret');
    await kms.scheduleKeyDeletion(arn);
    await expect(decryptColumn(kms, enc)).rejects.toThrow(/key\.unavailable/);
  });
});
