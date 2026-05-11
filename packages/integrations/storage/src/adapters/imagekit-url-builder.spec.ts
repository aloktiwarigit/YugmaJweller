import { describe, it, expect, beforeEach } from 'vitest';
import { ImageKitTransformUrlBuilder } from './imagekit-url-builder';

describe('ImageKitTransformUrlBuilder', () => {
  let builder: ImageKitTransformUrlBuilder;

  beforeEach(() => {
    process.env['IMAGEKIT_ID'] = 'testid';
    builder = new ImageKitTransformUrlBuilder();
  });

  describe('cardSrcset()', () => {
    it('emits exactly 320w and 640w entries', () => {
      const result = builder.cardSrcset('shops/s1/products/p1/img.jpg');
      expect(result).toContain('320w');
      expect(result).toContain('640w');
      expect(result).not.toContain('1024w');
      expect(result).not.toContain('1920w');
    });

    it('follows the same URL pattern as url()', () => {
      const key = 'shops/s1/products/p1/img.jpg';
      const result = builder.cardSrcset(key);
      const expected320 = builder.url(key, { width: 320 });
      const expected640 = builder.url(key, { width: 640 });
      expect(result).toBe(`${expected320} 320w, ${expected640} 640w`);
    });
  });
});
