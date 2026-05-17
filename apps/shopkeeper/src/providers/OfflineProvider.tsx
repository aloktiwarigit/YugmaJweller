import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { addEventListener, fetch as fetchNetInfo } from '@react-native-community/netinfo';
import type { ConflictRecord } from '@goldsmith/sync';
import { database } from '../db';
import { performSync } from '../db/sync';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../stores/authStore';

const SYNC_INTERVAL_MS = 30_000;

export interface OfflineContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflicts: ConflictRecord[];
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  lastSyncFailedAt: Date | null;
  dismissConflicts: () => void;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  conflicts: [],
  lastSyncAt: null,
  lastSyncError: null,
  lastSyncFailedAt: null,
  dismissConflicts: () => undefined,
});

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

function describeSyncError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown offline sync failure';
}

export function OfflineProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const authLoading = useAuthStore((s) => s.loading);
  const idToken = useAuthStore((s) => s.idToken);
  const user = useAuthStore((s) => s.user);
  const canSync = !authLoading && idToken !== null && user !== null;
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastSyncFailedAt, setLastSyncFailedAt] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const products = await database.get('products').query().fetch();
      setPendingCount((products as unknown as Array<{ pendingSync: boolean }>).filter((p) => p.pendingSync).length);
    } catch {
      // non-critical
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!canSync) return;
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await performSync(database, apiClient);
      if (result.conflicts.length > 0) {
        setConflicts((prev) => [...prev, ...result.conflicts]);
      }
      setLastSyncAt(new Date());
      setLastSyncError(null);
      setLastSyncFailedAt(null);
      await refreshPendingCount();
    } catch (error) {
      const message = describeSyncError(error);
      const failedAt = new Date();
      setLastSyncError(message);
      setLastSyncFailedAt(failedAt);
      console.warn('[OfflineProvider] Offline sync failed', {
        message,
        failedAt: failedAt.toISOString(),
      });
      // sync failure is non-fatal; retry on next tick
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [canSync, refreshPendingCount]);

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => { void runSync(); }, SYNC_INTERVAL_MS);
  }, [runSync]);

  useEffect(() => {
    if (!canSync) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return undefined;
    }

    const unsubscribe = addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) {
        void runSync();
        startInterval();
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    });

    void fetchNetInfo().then((state) => {
      if (state.isConnected === true) {
        void runSync();
        startInterval();
      }
    });

    return () => {
      unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [canSync, runSync, startInterval]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        conflicts,
        lastSyncAt,
        lastSyncError,
        lastSyncFailedAt,
        dismissConflicts: () => setConflicts([]),
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}
