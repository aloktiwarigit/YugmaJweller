import { auth } from './firebase';

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const u = auth().currentUser as { getIdToken: (force: boolean) => Promise<string> } | null;
  if (!u) return null;
  return u.getIdToken(forceRefresh);
}
