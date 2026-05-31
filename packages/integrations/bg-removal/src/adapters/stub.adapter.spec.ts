import { describe, it, expect } from 'vitest';
import { StubBgRemovalAdapter } from './stub.adapter';
import { BgRemovalUnavailableError } from '../errors';

describe('StubBgRemovalAdapter', () => {
  it('throws BgRemovalUnavailableError', async () => {
    const a = new StubBgRemovalAdapter();
    await expect(
      a.removeBackground({ image: Buffer.from('') }),
    ).rejects.toBeInstanceOf(BgRemovalUnavailableError);
  });
});
