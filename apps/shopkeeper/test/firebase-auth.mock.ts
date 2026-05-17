import { vi } from 'vitest';

type FirebaseUser = {
  uid: string;
  phoneNumber: string | null;
  getIdToken: (force?: boolean) => Promise<string>;
};

type AuthStateCallback = (u: FirebaseUser | null) => void;

let currentUser: FirebaseUser | null = null;
let listener: AuthStateCallback | null = null;

export const __setCurrentUser = (u: FirebaseUser | null): void => {
  currentUser = u;
  if (listener) listener(u);
};

export const __signOut = vi.fn(async (): Promise<void> => {
  currentUser = null;
  if (listener) listener(null);
});

const auth = (): {
  currentUser: FirebaseUser | null;
  onAuthStateChanged: (cb: AuthStateCallback) => () => void;
  signOut: () => Promise<void>;
} => ({
  get currentUser() {
    return currentUser;
  },
  onAuthStateChanged(cb: AuthStateCallback): () => void {
    listener = cb;
    // emit current user asynchronously on subscribe (matches Firebase SDK behaviour)
    const initialUser = currentUser;
    queueMicrotask(() => {
      if (listener === cb && currentUser === initialUser) cb(initialUser);
    });
    return (): void => {
      listener = null;
    };
  },
  signOut: __signOut,
});

export default auth;
