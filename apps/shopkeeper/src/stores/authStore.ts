import { create } from 'zustand';

export interface FirebaseUserSummary {
  uid: string;
  phoneNumber: string | null;
}

export interface AuthenticatedUser {
  id: string;
  shopId: string;
  role: string;
  displayName: string;
}

export interface AuthState {
  firebaseUser: FirebaseUserSummary | null;
  user: AuthenticatedUser | null;
  idToken: string | null;
  loading: boolean;
  setFirebaseUser: (u: FirebaseUserSummary | null) => void;
  setUser: (u: AuthenticatedUser | null) => void;
  setIdToken: (t: string | null) => void;
  setLoading: (b: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  user: null,
  idToken: null,
  loading: true,
  setFirebaseUser: (u): void => set({ firebaseUser: u }),
  setUser: (u): void => set({ user: u }),
  setIdToken: (t): void => set({ idToken: t }),
  setLoading: (b): void => set({ loading: b }),
  reset: (): void => set({ firebaseUser: null, user: null, idToken: null, loading: false }),
}));
