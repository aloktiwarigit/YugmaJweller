import * as SecureStore from 'expo-secure-store';

export const SECURE_KEY = 'customer_session_v1';

export interface PersistedSession {
  bearer: string;
  customerId: string;
  shopId: string;
}

export async function saveSecureSession(s: PersistedSession): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEY, JSON.stringify(s));
}

export async function loadSecureSession(): Promise<PersistedSession | null> {
  const raw = await SecureStore.getItemAsync(SECURE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

export async function clearSecureSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_KEY);
}
