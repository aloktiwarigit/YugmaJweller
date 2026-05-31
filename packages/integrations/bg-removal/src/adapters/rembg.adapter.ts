import { spawn } from 'node:child_process';
import sharp from 'sharp';
import type { BgRemovalAdapter, RemoveBackgroundInput, RemoveBackgroundResult } from '../types';
import { BgRemovalUnavailableError } from '../errors';

export class RembgAdapter implements BgRemovalAdapter {
  private readonly cmd = process.env['REMBG_CMD'] ?? 'rembg';

  async removeBackground(input: RemoveBackgroundInput): Promise<RemoveBackgroundResult> {
    const model = input.quality === 'fine' ? 'birefnet-general' : 'isnet-general-use';
    const png = await this.runRembg(input.image, model);

    const meta = await sharp(png).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    const trimmed = await sharp(png).trim().toBuffer({ resolveWithObject: true });
    const info = trimmed.info as unknown as {
      trimOffsetLeft?: number;
      trimOffsetTop?: number;
      width: number;
      height: number;
    };
    const bbox = {
      x: Math.abs(info.trimOffsetLeft ?? 0),
      y: Math.abs(info.trimOffsetTop ?? 0),
      width: info.width,
      height: info.height,
    };

    return { png, bbox, width, height };
  }

  private runRembg(image: Buffer, model: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.cmd, ['i', '-m', model], { stdio: ['pipe', 'pipe', 'pipe'] });
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      proc.stdout.on('data', (d: Buffer) => out.push(d));
      proc.stderr.on('data', (d: Buffer) => err.push(d));
      proc.on('error', (e) =>
        reject(new BgRemovalUnavailableError(`rembg spawn failed: ${e.message}`)),
      );
      proc.on('close', (code) => {
        if (code === 0) resolve(Buffer.concat(out));
        else
          reject(
            new BgRemovalUnavailableError(
              `rembg exited ${code}: ${Buffer.concat(err).toString()}`,
            ),
          );
      });
      proc.stdin.write(image);
      proc.stdin.end();
    });
  }
}
