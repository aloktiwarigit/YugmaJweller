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

const auth = (): {
  currentUser: FirebaseUser | null;
  onAuthStateChanged: (cb: AuthStateCallback) => () => void;
} => ({
  get currentUser() {
    return currentUser;
  },
  onAuthStateChanged(cb: AuthStateCallback): () => void {
    listener = cb;
    // emit current user asynchronously on subscribe (matches Firebase SDK behaviour)
    queueMicrotask(() => cb(currentUser));
    return (): void => {
      listener = null;
    };
  },
});

export default auth;
