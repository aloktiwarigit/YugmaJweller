import { describe, it, expect, beforeEach } from 'vitest';
import { ImageKitTransformUrlBuilder } from '../src/adapters/imagekit-url-builder';

describe('ImageKitTransformUrlBuilder', () => {
  beforeEach(() => {
    process.env['IMAGEKIT_ID'] = 'goldsmith-test';
  });

  it('emits q-auto, f-auto, and mb-0.25 in every URL (binding NFR-IMG-1)', () => {
    const b = new ImageKitTransformUrlBuilder();
    for (const w of [200, 320, 640, 1024, 1920]) {
      const url = b.url('k.jpg', { width: w });
      expect(url).toContain(`w-${w}`);
      expect(url).toContain('q-auto');
      expect(url).toContain('f-auto');
      expect(url).toContain('mb-0.25');
      expect(url).not.toContain('bl-');
    }
  });

  it('emits bl-N when blur is supplied', () => {
    const b = new ImageKitTransformUrlBuilder();
    const url = b.url('k.jpg', { width: 200, blur: 30 });
    expect(url).toContain('w-200');
    expect(url).toContain('bl-30');
    expect(url).toContain('mb-0.25');                         // cap still applies to LQIP
  });

  it('omits bl when blur is undefined', () => {
    const b = new ImageKitTransformUrlBuilder();
    const url = b.url('k.jpg', { width: 200 });
    expect(url).not.toContain('bl-');
  });

  it('uses IMAGEKIT_ID env var', () => {
    const b = new ImageKitTransformUrlBuilder();
    const url = b.url('k.jpg', { width: 1024 });
    expect(url).toContain('https://ik.imagekit.io/goldsmith-test/');
  });

  it('srcset emits 4 candidates with correct width descriptors', () => {
    const b = new ImageKitTransformUrlBuilder();
    const set = b.srcset('k.jpg');
    expect(set).toMatch(/320w/);
    expect(set).toMatch(/640w/);
    expect(set).toMatch(/1024w/);
    expect(set).toMatch(/1920w/);
    // Each URL embeds commas inside `tr=`, so split-by-`,` over-counts.
    // Count the `<width>w` descriptors instead — one per srcset candidate.
    const widthDescriptors = set.match(/\b\d+w\b/g);
    expect(widthDescriptors).toEqual(['320w', '640w', '1024w', '1920w']);
    expect(set).toContain('mb-0.25');
  });
});
