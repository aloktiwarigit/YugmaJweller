import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@nozbe/watermelondb';
import type { AxiosInstance } from 'axios';
import type { ConflictRecord } from '@goldsmith/sync';
import { syncWithServer } from '../watermelon-adapter';

const CURSOR_KEY = '@goldsmith/sync_cursor';

export interface SyncResult {
  cursor: bigint;
  conflicts: ConflictRecord[];
}

export async function performSync(database: Database, apiClient: AxiosInstance): Promise<SyncResult> {
  const stored = await AsyncStorage.getItem(CURSOR_KEY);
  const lastCursor = stored ? BigInt(stored) : 0n;

  const { cursor, conflicts } = await syncWithServer(database, apiClient, lastCursor);

  await AsyncStorage.setItem(CURSOR_KEY, cursor.toString());
  return { cursor, conflicts };
}
