import { describe, expect, it } from 'vitest';
import { serializeEnvelope, deserializeEnvelope } from './envelope-codec';
import { encryptColumn, decryptColumn } from './envelope';
import { LocalKMS } from './local-kms';

describe('serializeEnvelope / deserializeEnvelope', () => {
  it('round-trips through serialize → deserialize', async () => {
    const kms = new LocalKMS();
    const keyArn = await kms.createKeyForTenant('shop-test');
    const plaintext = 'ABCDE1234F';

    const envelope = await encryptColumn(kms, keyArn, plaintext);
    const serialized = serializeEnvelope(envelope);
    const deserialized = deserializeEnvelope(serialized, keyArn);

    expect(deserialized.keyArn).toBe(keyArn);
    expect(deserialized.iv).toEqual(envelope.iv);
    expect(deserialized.tag).toEqual(envelope.tag);
    expect(deserialized.ciphertext).toEqual(envelope.ciphertext);
    expect(deserialized.encryptedDek).toEqual(envelope.encryptedDek);

    const decrypted = await decryptColumn(kms, deserialized);
    expect(decrypted).toBe(plaintext);
  });

  it('is a Buffer', async () => {
    const kms = new LocalKMS();
    const keyArn = await kms.createKeyForTenant('shop-test-2');
    const envelope = await encryptColumn(kms, keyArn, 'test');
    const serialized = serializeEnvelope(envelope);
    expect(Buffer.isBuffer(serialized)).toBe(true);
  });

  it('throws on buffer too short to be valid', () => {
    expect(() => deserializeEnvelope(Buffer.alloc(10), 'arn')).toThrow('too short');
  });

  it('per-tenant key isolation: decrypting with wrong key ARN fails', async () => {
    const kms = new LocalKMS();
    const arnA = await kms.createKeyForTenant('shop-A');
    const arnB = await kms.createKeyForTenant('shop-B');

    const envelope = await encryptColumn(kms, arnA, 'ABCDE1234F');
    const serialized = serializeEnvelope(envelope);
    // Deserialize with correct bytes but wrong key ARN → decryptDataKey will fail
    const deserialized = deserializeEnvelope(serialized, arnB);
    await expect(decryptColumn(kms, deserialized)).rejects.toThrow();
  });
});
