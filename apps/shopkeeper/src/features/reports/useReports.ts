import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '../../api/client';

export interface DailySummaryData {
  date: string;
  total_paise: string;
  cash_paise: string;
  upi_paise: string;
  other_paise: string;
  invoice_count: number;
  gold_weight_mg: string;
}

export interface OutstandingItem {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string | null;
  total_paise: string;
  balance_due_paise: string;
  issued_at: string | null;
}

export interface OutstandingData {
  items: OutstandingItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomerLtvItem {
  customer_id: string;
  name: string;
  phone: string;
  ltv_paise: string;
}

export interface LoyaltySummaryData {
  points_issued: number;
  points_redeemed: number;
  members_by_tier: { tier: string | null; count: number }[];
}

function todayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

export function useDailySummary(date?: string): UseQueryResult<DailySummaryData> {
  const target = date ?? todayIST();
  return useQuery({
    queryKey: ['reports', 'daily-summary', target],
    queryFn: async () => {
      const res = await api.get<DailySummaryData>(`/api/v1/reports/daily-summary`, { params: { date: target } });
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useOutstanding(page = 1, limit = 20): UseQueryResult<OutstandingData> {
  return useQuery({
    queryKey: ['reports', 'outstanding', page, limit],
    queryFn: async () => {
      const res = await api.get<OutstandingData>(`/api/v1/reports/outstanding`, { params: { page, limit } });
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useCustomerLtv(limit = 20): UseQueryResult<CustomerLtvItem[]> {
  return useQuery({
    queryKey: ['reports', 'customer-ltv', limit],
    queryFn: async () => {
      const res = await api.get<CustomerLtvItem[]>(`/api/v1/reports/customer-ltv`, { params: { limit } });
      return res.data;
    },
    staleTime: 300_000,
  });
}

export function useLoyaltySummary(): UseQueryResult<LoyaltySummaryData> {
  return useQuery({
    queryKey: ['reports', 'loyalty-summary'],
    queryFn: async () => {
      const res = await api.get<LoyaltySummaryData>(`/api/v1/reports/loyalty-summary`);
      return res.data;
    },
    staleTime: 300_000,
  });
}

export interface StockAgingBucket {
  label: '<30d' | '30-60d' | '60-90d' | '90d+';
  count: number;
  totalWeightMg: string;
  totalCostPaise: string;
}

export interface StockAgingItem {
  id: string;
  sku: string;
  metal: string;
  purity: string;
  weightG: string;
  daysInStock: number;
  bucket: StockAgingBucket['label'];
  costPaise: string | null;
  firstListedAt: string;
}

export interface StockAgingData {
  buckets: StockAgingBucket[];
  items: StockAgingItem[];
}

export function useStockAging(): UseQueryResult<StockAgingData> {
  return useQuery({
    queryKey: ['reports', 'stock-aging'],
    queryFn: async () => {
      const res = await api.get<StockAgingData>(`/api/v1/reports/stock-aging`);
      return res.data;
    },
    staleTime: 300_000,
  });
}

export function formatPaise(paise: string): string {
  const rupees = Math.round(parseInt(paise, 10) / 100);
  return new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(rupees);
}

export function formatWeightMg(mg: string): string {
  const g = parseInt(mg, 10) / 1000;
  return `${g.toFixed(3)} ग्राम`;
}
