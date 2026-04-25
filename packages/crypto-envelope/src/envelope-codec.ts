import type { EnvelopeCiphertext } from './envelope';

/**
 * Wire format (no keyArn — stored separately as pan_key_id / form60_key_id):
 *   [4 bytes uint32 BE: encryptedDek length]
 *   [encryptedDek bytes]
 *   [12 bytes: iv]
 *   [16 bytes: GCM auth tag]
 *   [remaining bytes: ciphertext]
 */
export function serializeEnvelope(env: Omit<EnvelopeCiphertext, 'keyArn'>): Buffer {
  const dekLen = env.encryptedDek.byteLength;
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(dekLen, 0);
  return Buffer.concat([lenBuf, env.encryptedDek, env.iv, env.tag, env.ciphertext]);
}

export function deserializeEnvelope(
  buf: Buffer,
  keyArn: string,
): EnvelopeCiphertext {
  if (buf.byteLength < 4 + 12 + 16) {
    throw new Error('envelope-codec: buffer too short to be a valid envelope');
  }
  const dekLen = buf.readUInt32BE(0);
  let offset = 4;
  const encryptedDek = buf.subarray(offset, offset + dekLen);
  offset += dekLen;
  const iv = buf.subarray(offset, offset + 12);
  offset += 12;
  const tag = buf.subarray(offset, offset + 16);
  offset += 16;
  const ciphertext = buf.subarray(offset);
  return { ciphertext, encryptedDek, iv, tag, keyArn };
}
