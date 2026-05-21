import type { QueryClient } from '@tanstack/react-query';
import type { WishlistItem } from '../api/endpoints';

export const wishlistQueryKey = ['wishlist'] as const;

export interface WishlistProductSnapshot {
  id: string;
  sku?: string | null;
  purity?: string | null;
  metal?: string | null;
  grossWeightG?: string | null;
  netWeightG?: string | null;
  huid?: string | null;
}

export function wishlistItemFromProduct(product: WishlistProductSnapshot): WishlistItem {
  return {
    productId: product.id,
    sku: product.sku ?? '',
    purity: product.purity ?? '',
    metal: product.metal ?? '',
    grossWeightG: product.grossWeightG ?? product.netWeightG ?? '',
    netWeightG: product.netWeightG ?? '',
    huid: product.huid ?? null,
    addedAt: new Date().toISOString(),
  };
}

export function addWishlistItem(items: WishlistItem[], item: WishlistItem): WishlistItem[] {
  if (items.some((w) => w.productId === item.productId)) return items;
  return [item, ...items];
}

export function removeWishlistItem(items: WishlistItem[], productId: string): WishlistItem[] {
  return items.filter((w) => w.productId !== productId);
}

export async function optimisticallySetWishlist(
  queryClient: QueryClient,
  item: WishlistItem,
  add: boolean,
): Promise<{ previous: WishlistItem[] }> {
  await queryClient.cancelQueries({ queryKey: wishlistQueryKey });
  const previous = queryClient.getQueryData<WishlistItem[]>(wishlistQueryKey) ?? [];
  queryClient.setQueryData<WishlistItem[]>(wishlistQueryKey, (old = []) =>
    add ? addWishlistItem(old, item) : removeWishlistItem(old, item.productId),
  );
  return { previous };
}
