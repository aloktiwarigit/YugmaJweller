export interface RemoveBackgroundInput {
  /** Raw source image bytes (jpeg/png). */
  image: Buffer;
  /** Hint to pick a model: 'fine' uses BiRefNet for thin chains/filigree. */
  quality?: 'standard' | 'fine';
}

export interface RemoveBackgroundResult {
  /** Transparent PNG bytes. */
  png: Buffer;
  /** Tight alpha bounding box in pixels, for anchor auto-proposal. */
  bbox: { x: number; y: number; width: number; height: number };
  width: number;
  height: number;
}

export interface BgRemovalAdapter {
  removeBackground(input: RemoveBackgroundInput): Promise<RemoveBackgroundResult>;
}
