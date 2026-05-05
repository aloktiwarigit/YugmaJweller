import { useEffect, useState, useCallback } from 'react';
import { Linking } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';

export type ReportType =
  | 'daily-summary' | 'outstanding' | 'customer-ltv'
  | 'loyalty-summary' | 'stock-aging';

export type ExportStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';

export interface ExportStatusResponse {
  id:             string;
  reportType:     ReportType;
  status:         ExportStatus;
  downloadUrl?:   string;
  blobExpiresAt?: string;
  errorMessage?:  string;
}

export interface UseReportExportResult {
  status:         ExportStatus | 'IDLE';
  exportId:       string | null;
  downloadUrl?:   string;
  errorMessage?:  string;
  start:          (params?: Record<string, unknown>) => void;
  regenerate:     () => Promise<void>;
  reset:          () => void;
}

export function useReportExport(reportType: ReportType): UseReportExportResult {
  const [exportId, setExportId] = useState<string | null>(null);
  const [pollingStartedAt, setPollingStartedAt] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const start = useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      const res = await api.post<{ id: string; status: 'QUEUED' }>(
        '/api/v1/reports/exports',
        { reportType, params },
      );
      return res.data;
    },
    onSuccess: (data) => {
      setExportId(data.id);
      setPollingStartedAt(Date.now());
    },
  });

  const status = useQuery({
    queryKey: ['reports', 'exports', exportId],
    queryFn: async (): Promise<ExportStatusResponse> => {
      const res = await api.get<ExportStatusResponse>(`/api/v1/reports/exports/${exportId!}`);
      return res.data;
    },
    enabled: exportId !== null,
    refetchInterval: (q) => {
      const data = q.state.data as ExportStatusResponse | undefined;
      if (!data) return 2000;
      if (data.status === 'READY' || data.status === 'FAILED') return false;
      // 2-minute polling ceiling — surfaces stuck-job state to senior shopkeeper
      if (pollingStartedAt && Date.now() - pollingStartedAt > 120_000) return false;
      return 2000;
    },
  });

  // Auto-open when ready (single-trigger)
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  useEffect(() => {
    const data = status.data;
    if (data && data.status === 'READY' && data.downloadUrl && openedFor !== data.id) {
      setOpenedFor(data.id);
      void Linking.openURL(data.downloadUrl);
    }
  }, [status.data, openedFor]);

  const regenerate = useCallback(async () => {
    if (!exportId) return;
    const res = await api.post<ExportStatusResponse>(`/api/v1/reports/exports/${exportId}/regenerate`);
    if (res.data.status === 'READY' && res.data.downloadUrl) {
      void Linking.openURL(res.data.downloadUrl);
    }
    void status.refetch();
  }, [exportId, status]);

  const reset = useCallback(() => {
    if (exportId) {
      queryClient.removeQueries({ queryKey: ['reports', 'exports', exportId] });
    }
    setExportId(null);
    setOpenedFor(null);
    setPollingStartedAt(null);
  }, [exportId, queryClient]);

  const timedOut = pollingStartedAt !== null
    && Date.now() - pollingStartedAt > 120_000
    && status.data?.status !== 'READY'
    && status.data?.status !== 'FAILED';

  return {
    status: exportId === null
      ? 'IDLE' as const
      : timedOut
        ? 'FAILED' as const
        : (status.data?.status ?? 'QUEUED'),
    exportId,
    downloadUrl:   status.data?.downloadUrl,
    errorMessage:  timedOut
      ? 'PDF तैयार नहीं हो सका — कृपया पुनः प्रयास करें।'
      : status.data?.errorMessage,
    start:         (params) => start.mutate(params ?? {}),
    regenerate,
    reset,
  };
}
