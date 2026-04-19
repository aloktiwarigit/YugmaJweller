import { auth } from './firebase';

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  // @why Firebase User type is SDK-internal; inline the shape we actually use rather than import the real SDK into vitest.
  const u = auth().currentUser as { getIdToken: (force: boolean) => Promise<string> } | null;
  if (!u) return null;
  return u.getIdToken(forceRefresh);
}
