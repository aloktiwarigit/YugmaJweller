import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const SECURE_KEY = 'customer_session_v1';

export interface PersistedSession {
  bearer: string;
  customerId: string;
  shopId: string;
}

// expo-secure-store ships with native iOS/Android backends only.
// `expo export --platform web` (the WS-E smoke path) and any browser run
// reach a no-op web shim that throws on getItemAsync/setItemAsync, which
// would crash CustomerAuthProvider's bootstrap effect and strand the
// dev-auth flow on web. Treat the wrapper as best-effort persistence:
// on web (or any unsupported runtime) we silently skip — the customer
// session simply does not persist across reloads, which is acceptable
// for the dev-mode mock that re-injects on every boot anyway. Native
// runtimes always go through SecureStore.
//
// Evaluated per-call (not memoised) so a runtime that toggles Platform.OS
// — e.g. a unit test exercising the web bypass — observes the change.
function isSecureStoreAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function saveSecureSession(s: PersistedSession): Promise<void> {
  if (!isSecureStoreAvailable()) return;
  try {
    await SecureStore.setItemAsync(SECURE_KEY, JSON.stringify(s));
  } catch {
    // Defensive — even on native, do not crash the boot path on a
    // SecureStore failure.
  }
}

export async function loadSecureSession(): Promise<PersistedSession | null> {
  if (!isSecureStoreAvailable()) return null;
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(SECURE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

export async function clearSecureSession(): Promise<void> {
  if (!isSecureStoreAvailable()) return;
  try {
    await SecureStore.deleteItemAsync(SECURE_KEY);
  } catch {
    // No-op — best-effort.
  }
}
