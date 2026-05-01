import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import { saveSecureSession, loadSecureSession, clearSecureSession, SECURE_KEY } from './secure-storage';

describe('secure-storage', () => {
  beforeEach(() => {
    (SecureStore as unknown as { __reset: () => void }).__reset();
    vi.clearAllMocks();
  });

  it('round-trips a session', async () => {
    await saveSecureSession({ bearer: 'tok', customerId: 'cid', shopId: 'sid' });
    const loaded = await loadSecureSession();
    expect(loaded).toEqual({ bearer: 'tok', customerId: 'cid', shopId: 'sid' });
  });

  it('returns null when nothing stored', async () => {
    expect(await loadSecureSession()).toBeNull();
  });

  it('clears the session', async () => {
    await saveSecureSession({ bearer: 'tok', customerId: 'cid', shopId: 'sid' });
    await clearSecureSession();
    expect(await loadSecureSession()).toBeNull();
  });

  it('uses the documented key (no AsyncStorage drift)', async () => {
    await saveSecureSession({ bearer: 'tok', customerId: 'cid', shopId: 'sid' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SECURE_KEY, expect.any(String));
    expect(SECURE_KEY).toBe('customer_session_v1');
  });
});
