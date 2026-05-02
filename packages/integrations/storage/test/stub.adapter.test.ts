import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { StubStorageAdapter } from '../src/adapters/stub.adapter';

describe('StubStorageAdapter (disk-backed)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gs-stub-'));
    process.env['STUB_STORAGE_DIR'] = dir;
  });

  afterEach(async () => {
    delete process.env['STUB_STORAGE_DIR'];
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('uploadBuffer + downloadBuffer round-trip preserves bytes', async () => {
    const adapter = new StubStorageAdapter();
    const data = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    await adapter.uploadBuffer('tenant/abc/products/xyz/img.jpg', data, 'image/jpeg');
    const back = await adapter.downloadBuffer('tenant/abc/products/xyz/img.jpg');
    expect(back.equals(data)).toBe(true);
  });

  it('deleteBlob removes the file; second delete is lenient', async () => {
    const adapter = new StubStorageAdapter();
    await adapter.uploadBuffer('k.bin', Buffer.from('x'), 'application/octet-stream');
    await adapter.deleteBlob('k.bin');
    await expect(adapter.deleteBlob('k.bin')).resolves.not.toThrow();
  });

  it('getPublicUrl returns a 127.0.0.1 dev URL', async () => {
    const adapter = new StubStorageAdapter();
    const url = await adapter.getPublicUrl('k.bin');
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect(url).toContain('/dev-storage/k.bin');
  });
});
