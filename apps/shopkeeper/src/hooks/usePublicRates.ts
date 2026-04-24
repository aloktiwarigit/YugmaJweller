import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../api/client';
import type { PublicRatesResponse } from '@goldsmith/ui-mobile';

async function fetchPublicRates(): Promise<PublicRatesResponse> {
  const res = await api.get<PublicRatesResponse>('/api/v1/catalog/rates');
  return res.data;
}

export function usePublicRates(): UseQueryResult<PublicRatesResponse> {
  return useQuery({
    queryKey: ['catalog', 'rates'],
    queryFn: fetchPublicRates,
    refetchInterval: 60_000,
    staleTime: 55_000,
  });
}
