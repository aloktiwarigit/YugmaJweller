import { useEffect } from 'react';
import { auth } from '@goldsmith/auth-client';
import { useAuthStore } from '../stores/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);
  const setIdToken = useAuthStore((s) => s.setIdToken);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged(
      async (
        u: { uid: string; phoneNumber: string | null; getIdToken: () => Promise<string> } | null,
      ) => {
        if (!u) {
          setFirebaseUser(null);
          setIdToken(null);
          setLoading(false);
          return;
        }
        setFirebaseUser({ uid: u.uid, phoneNumber: u.phoneNumber });
        const token = await u.getIdToken();
        setIdToken(token);
        setLoading(false);
      },
    );
    return (): void => unsub();
  }, [setFirebaseUser, setIdToken, setLoading]);

  return <>{children}</>;
}
