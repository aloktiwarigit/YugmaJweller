import type { BgRemovalAdapter, RemoveBackgroundInput, RemoveBackgroundResult } from '../types';
import { BgRemovalUnavailableError } from '../errors';

export class StubBgRemovalAdapter implements BgRemovalAdapter {
  async removeBackground(_input: RemoveBackgroundInput): Promise<RemoveBackgroundResult> {
    throw new BgRemovalUnavailableError(
      'StubBgRemovalAdapter called — set BG_REMOVAL_ADAPTER=rembg to enable real cutouts',
    );
  }
}
