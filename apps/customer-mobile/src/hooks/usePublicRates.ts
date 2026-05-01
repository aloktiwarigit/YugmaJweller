import { useQuery } from '@tanstack/react-query';
import { getPublicRates, type PublicRatesResponse } from '../api/endpoints';

export function usePublicRates(): {
  data: PublicRatesResponse | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const q = useQuery({
    queryKey: ['public-rates'],
    queryFn: getPublicRates,
    staleTime: 60_000,
    retry: false,
  });
  return { data: q.data, isLoading: q.isLoading, isError: q.isError };
}
