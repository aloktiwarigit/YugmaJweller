import { useQuery } from '@tanstack/react-query';
import { getPublicRates, type PublicRatesResponse } from '../api/endpoints';
import { useTenantStore } from '../stores/tenantStore';

export function usePublicRates(): {
  data: PublicRatesResponse | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const slug = useTenantStore((s) => s.slug);
  const q = useQuery({
    queryKey: ['public-rates', slug],
    queryFn: getPublicRates,
    staleTime: 60_000,
    retry: false,
  });
  return { data: q.data, isLoading: q.isLoading, isError: q.isError };
}
