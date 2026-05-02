import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { StoragePort } from '../storage.port';

const PORT = process.env['PORT'] ?? '3000';

/**
 * Dev/CI stub: writes blobs to local disk under STUB_STORAGE_DIR (default ./tmp/storage).
 * Public URLs route to a dev-only Express middleware on the API at /dev-storage/:key
 * that serves files from STUB_STORAGE_DIR. Bound to 127.0.0.1 only — never deployed.
 */
export class StubStorageAdapter implements StoragePort {
  private readonly baseDir: string;
  private readonly publicBase: string;

  constructor() {
    this.baseDir = process.env['STUB_STORAGE_DIR'] ?? path.join(process.cwd(), 'tmp', 'storage');
    this.publicBase = process.env['STUB_STORAGE_PUBLIC_BASE'] ?? `http://127.0.0.1:${PORT}/dev-storage`;
  }

  async getPresignedUploadUrl(key: string, _contentType: string): Promise<string> {
    return `${this.publicBase}/${key}?upload=STUB`;
  }

  async getPublicUrl(key: string): Promise<string> {
    return `${this.publicBase}/${key}`;
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    const absPath = path.join(this.baseDir, key);
    return fs.readFile(absPath);
  }

  async uploadBuffer(key: string, data: Buffer, _contentType: string): Promise<void> {
    const absPath = path.join(this.baseDir, key);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, data);
  }

  async getPresignedReadUrl(key: string): Promise<string> {
    return this.getPublicUrl(key);
  }

  async deleteBlob(key: string): Promise<void> {
    const absPath = path.join(this.baseDir, key);
    try {
      await fs.unlink(absPath);
    } catch (err: unknown) {
      // Best-effort: ignore missing file (matches Azure adapter's leniency)
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}
