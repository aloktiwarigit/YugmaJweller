import { describe, expect, it } from 'vitest';
import { resolveShopSlug } from './tenant-slug';

function headers(values: Record<string, string | null>) {
  return {
    get(name: string): string | null {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

describe('resolveShopSlug', () => {
  it('uses an explicit tenant header first', () => {
    expect(
      resolveShopSlug(headers({ 'x-shop-slug': 'ANCHOR-DEV', host: 'localhost:3000' }), {
        NEXT_PUBLIC_SHOP_SLUG: 'other-shop',
      }),
    ).toBe('anchor-dev');
  });

  it('uses configured slug when no tenant header is present', () => {
    expect(
      resolveShopSlug(headers({ host: 'shop.example.com' }), {
        NEXT_PUBLIC_SHOP_SLUG: 'anchor-dev',
      }),
    ).toBe('anchor-dev');
  });

  it('defaults localhost development to anchor-dev', () => {
    expect(resolveShopSlug(headers({ host: 'localhost:3000' }), {})).toBe('anchor-dev');
    expect(resolveShopSlug(headers({ host: '127.0.0.1:3000' }), {})).toBe('anchor-dev');
  });

  it('does not invent a tenant on production hosts', () => {
    expect(resolveShopSlug(headers({ host: 'goldsmith.example.com' }), {})).toBeNull();
  });
});
