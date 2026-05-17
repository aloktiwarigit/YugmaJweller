import { useEffect } from 'react';
import axios from 'axios';
import Constants from 'expo-constants';
import { auth } from '../auth/client';
import { useAuthStore } from '../stores/authStore';
import { getAuthMe, postAuthSession, type AuthIdentityResponse } from '../api/endpoints';

type FirebaseAuthSession = ReturnType<typeof auth> & {
  signOut?: () => Promise<void>;
};

function configuredTenantSlug(): string {
  return (Constants.expoConfig?.extra?.['tenantSlug'] as string | undefined) ?? 'anchor-dev';
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function assertAuthTenantMatchesApp(session: AuthIdentityResponse): void {
  const expected = normalizeSlug(configuredTenantSlug());
  const actual = normalizeSlug(session.tenant.slug);
  if (!actual || actual !== expected) {
    throw new Error('auth.tenant_mismatch');
  }
}

function shouldSignOutAfterSessionError(error: unknown): boolean {
  if (error instanceof Error && error.message === 'auth.tenant_mismatch') return true;
  if (!axios.isAxiosError<{ code?: string; errorCode?: string }>(error)) return true;
  if (!error.response) return false;

  const code = error.response.data?.code ?? error.response.data?.errorCode;
  return (
    error.response.status === 401 ||
    code === 'auth.not_provisioned' ||
    code === 'auth.rejected' ||
    code === 'auth.uid_mismatch'
  );
}

function isTransientNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

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
          let activeToken = token;
          const session = await getAuthMe().catch(async (error: unknown) => {
            if (isTransientNetworkError(error)) throw error;
            const postedSession = await postAuthSession(token);
            if (postedSession.requires_token_refresh) {
              const refreshed = await u.getIdToken(true);
              activeToken = refreshed;
            }
            return postedSession;
          });
          assertAuthTenantMatchesApp(session);
          setIdToken(activeToken);
          setUser(session.user);
        } catch (error) {
          const shouldSignOut = shouldSignOutAfterSessionError(error);
          if (shouldSignOut) {
            const firebaseAuth = auth() as FirebaseAuthSession;
            await firebaseAuth.signOut?.();
            setFirebaseUser(null);
          }
          setIdToken(null);
          setUser(null);
        } finally {
          setLoading(false);
        }
      },
    );
    return (): void => unsub();
  }, [setFirebaseUser, setIdToken, setUser, setLoading]);

  return <>{children}</>;
}
