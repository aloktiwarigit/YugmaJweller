import type { BgRemovalAdapter } from './types';
import { StubBgRemovalAdapter } from './adapters/stub.adapter';

export function getBgRemovalAdapter(): BgRemovalAdapter {
  const which = process.env['BG_REMOVAL_ADAPTER'] ?? 'stub';
  switch (which) {
    case 'stub':
    default:
      return new StubBgRemovalAdapter();
  }
}
