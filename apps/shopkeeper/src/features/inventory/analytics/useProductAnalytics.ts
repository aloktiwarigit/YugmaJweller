import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../../../api/client';

export interface ViewSummary {
  totalViews: number;
  uniqueViewers: number;
  avgDurationSeconds: number | null;
}

export interface MultiPeriodViewSummary {
  '30d': ViewSummary;
  '90d': ViewSummary;
  '365d': ViewSummary;
}

export function useProductAnalytics(productId: string | undefined): UseQueryResult<MultiPeriodViewSummary> {
  return useQuery({
    queryKey: ['analytics', 'product-views', productId],
    queryFn: async () => {
      const res = await api.get<MultiPeriodViewSummary>(
        `/api/v1/analytics/products/${productId!}/views`,
      );
      return res.data;
    },
    staleTime: 5 * 60_000,
    enabled: !!productId,
  });
}
