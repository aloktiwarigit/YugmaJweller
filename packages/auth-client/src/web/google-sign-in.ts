import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onIdTokenChanged,
  type Auth,
  type User,
} from 'firebase/auth';

export interface SignInResult {
  user: User;
  idToken: string;
}

export async function signInWithGoogle(auth: Auth): Promise<SignInResult> {
  const provider = new GoogleAuthProvider();
  // prompt=select_account avoids the "auto-pick the last Google account" footgun for shared
  // workstations (a platform admin signing in from someone else's session).
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  return { user: result.user, idToken };
}

export async function signOutOfFirebase(auth: Auth): Promise<void> {
  await signOut(auth);
}

/** Subscribe to ID-token rotation so the admin UI can refresh its in-memory token. */
export function subscribeToIdToken(
  auth: Auth,
  onChange: (token: string | null) => void,
): () => void {
  return onIdTokenChanged(auth, async (user) => {
    if (!user) {
      onChange(null);
      return;
    }
    const t = await user.getIdToken();
    onChange(t);
  });
}
