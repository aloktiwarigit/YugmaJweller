import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import type { ConflictRecord } from '@goldsmith/sync';
import { database } from '../db';
import { performSync } from '../db/sync';
import { apiClient } from '../lib/api-client';

export interface OfflineContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflicts: ConflictRecord[];
  lastSyncAt: Date | null;
  dismissConflicts: () => void;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  conflicts: [],
  lastSyncAt: null,
  dismissConflicts: () => undefined,
});

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

const SYNC_INTERVAL_MS = 30_000;

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const products = await database.get('products').query().fetch();
      setPendingCount((products as Array<{ pendingSync: boolean }>).filter((p) => p.pendingSync).length);
    } catch {
      // non-critical
    }
  }, []);

  const runSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await performSync(database, apiClient);
      if (result.conflicts.length > 0) {
        setConflicts((prev) => [...prev, ...result.conflicts]);
      }
      setLastSyncAt(new Date());
      await refreshPendingCount();
    } catch {
      // sync failure is non-fatal; retry on next tick
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => { void runSync(); }, SYNC_INTERVAL_MS);
  }, [runSync]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) {
        void runSync();
        startInterval();
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    });

    void NetInfo.fetch().then((state) => {
      if (state.isConnected === true) {
        void runSync();
        startInterval();
      }
    });

    return () => {
      unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runSync, startInterval]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        conflicts,
        lastSyncAt,
        dismissConflicts: () => setConflicts([]),
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}
