import { useQuery } from '@tanstack/react-query';
import { getProductImages, type ProductImageRow } from '../api/endpoints';

export type { ProductImageRow };

/**
 * Fetches the public image list for a single product.
 * Maps to: GET /api/v1/catalog/products/:productId/images
 * Returns PublicImageRow[] (no storage_key — public DTO).
 */
export function useProductImages(productId: string | undefined): {
  data: ProductImageRow[];
  isLoading: boolean;
  isError: boolean;
} {
  const q = useQuery({
    queryKey: ['product-images', productId],
    queryFn:  () => getProductImages(productId!),
    enabled:  Boolean(productId),
    staleTime: 60_000,
    retry: false,
  });

  return {
    data:      q.data ?? [],
    isLoading: q.isLoading,
    isError:   q.isError,
  };
}
