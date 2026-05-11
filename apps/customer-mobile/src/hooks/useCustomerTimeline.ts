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

export function usePurchases(opts: PaginationOpts): UseQueryResult<PurchasesResponse> {
  return useQuery<PurchasesResponse>({
    queryKey:  ['customer-timeline', 'purchases', opts.limit, opts.offset],
    queryFn:   () => getPurchases(opts),
    staleTime: 30_000,
  });
}

export function useCustomOrders(opts: PaginationOpts): UseQueryResult<CustomOrdersResponse> {
  return useQuery<CustomOrdersResponse>({
    queryKey:  ['customer-timeline', 'custom-orders', opts.limit, opts.offset],
    queryFn:   () => getCustomOrders(opts),
    staleTime: 30_000,
  });
}

export function useRateLocks(opts: PaginationOpts): UseQueryResult<RateLockBookingsResponse> {
  return useQuery<RateLockBookingsResponse>({
    queryKey:  ['customer-timeline', 'rate-locks', opts.limit, opts.offset],
    queryFn:   () => getRateLockBookings(opts),
    staleTime: 30_000,
  });
}

export function useTryAtHomeBookings(opts: PaginationOpts): UseQueryResult<TryAtHomeBookingsListResponse> {
  return useQuery<TryAtHomeBookingsListResponse>({
    queryKey:  ['customer-timeline', 'try-at-home', opts.limit, opts.offset],
    queryFn:   () => getTryAtHomeBookings(opts),
    staleTime: 30_000,
  });
}
