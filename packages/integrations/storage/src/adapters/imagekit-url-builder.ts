/**
 * Pure URL builder. No HTTP client, no auth. Every URL emitted carries
 * `q-auto`, `f-auto`, and `mb-0.25` — the binding NFR-IMG-1 enforcement.
 * No code path may compose ImageKit URLs by hand; all callers go through
 * this builder.
 */
export class ImageKitTransformUrlBuilder {
  private readonly base: string;

  constructor() {
    const id = process.env['IMAGEKIT_ID'] ?? 'goldsmith';
    this.base = `https://ik.imagekit.io/${id}`;
  }

  url(key: string, opts: { width: number; blur?: number }): string {
    const parts: string[] = [`w-${opts.width}`];
    if (opts.blur !== undefined) parts.push(`bl-${opts.blur}`);
    parts.push('q-auto', 'f-auto', 'mb-0.25');
    return `${this.base}/${key}?tr=${parts.join(',')}`;
  }

  /**
   * Builds the customer-side srcset string for the 4 standard widths.
   * Output: "url320 320w, url640 640w, url1024 1024w, url1920 1920w"
   */
  srcset(key: string): string {
    return [320, 640, 1024, 1920]
      .map((w) => `${this.url(key, { width: w })} ${w}w`)
      .join(', ');
  }
}

export const IMAGEKIT_URL_BUILDER = 'IMAGEKIT_URL_BUILDER';
