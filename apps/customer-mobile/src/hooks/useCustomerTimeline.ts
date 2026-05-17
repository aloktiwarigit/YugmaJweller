import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  getPurchases,
  getCustomOrders,
  getRateLockBookings,
  getTryAtHomeBookings,
} from '../api/endpoints';
import type {
  PurchasesResponse,
  CustomOrdersResponse,
  RateLockBookingsResponse,
  TryAtHomeBookingsListResponse,
} from '../api/endpoints';

interface PaginationOpts {
  limit:  number;
  offset: number;
}

// `retry: false` so a 401 / 5xx fails fast and the timeline tab flips straight
// to the friendly empty-state instead of pulsing 3 skeleton cards for the full
// React-Query default retry budget (~7s with exponential backoff). See
// TimelinePurchases / TimelineCustomOrders / TimelineRateLocks /
// TimelineTryAtHome — all four treat `isError` as TimelineEmptyState now.

export function usePurchases(opts: PaginationOpts): UseQueryResult<PurchasesResponse> {
  return useQuery<PurchasesResponse>({
    queryKey:  ['customer-timeline', 'purchases', opts.limit, opts.offset],
    queryFn:   () => getPurchases(opts),
    staleTime: 30_000,
    retry:     false,
  });
}

export function useCustomOrders(opts: PaginationOpts): UseQueryResult<CustomOrdersResponse> {
  return useQuery<CustomOrdersResponse>({
    queryKey:  ['customer-timeline', 'custom-orders', opts.limit, opts.offset],
    queryFn:   () => getCustomOrders(opts),
    staleTime: 30_000,
    retry:     false,
  });
}

export function useRateLocks(opts: PaginationOpts): UseQueryResult<RateLockBookingsResponse> {
  return useQuery<RateLockBookingsResponse>({
    queryKey:  ['customer-timeline', 'rate-locks', opts.limit, opts.offset],
    queryFn:   () => getRateLockBookings(opts),
    staleTime: 30_000,
    retry:     false,
  });
}

export function useTryAtHomeBookings(opts: PaginationOpts): UseQueryResult<TryAtHomeBookingsListResponse> {
  return useQuery<TryAtHomeBookingsListResponse>({
    queryKey:  ['customer-timeline', 'try-at-home', opts.limit, opts.offset],
    queryFn:   () => getTryAtHomeBookings(opts),
    staleTime: 30_000,
    retry:     false,
  });
}
