import { useEffect } from 'react';
import { auth } from '@goldsmith/auth-client';
import { useAuthStore } from '../stores/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);
  const setIdToken = useAuthStore((s) => s.setIdToken);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged(
      async (
        u: { uid: string; phoneNumber: string | null; getIdToken: (force?: boolean) => Promise<string> } | null,
      ) => {
        if (!u) {
          setFirebaseUser(null);
          setIdToken(null);
          setUser(null);
          setLoading(false);
          return;
        }
        setFirebaseUser({ uid: u.uid, phoneNumber: u.phoneNumber });
        try {
          const token = await u.getIdToken();
          setIdToken(token);
        } catch {
          setIdToken(null);
        } finally {
          setLoading(false);
        }
      },
    );
    return (): void => unsub();
  }, [setFirebaseUser, setIdToken, setUser, setLoading]);

  return <>{children}</>;
}
