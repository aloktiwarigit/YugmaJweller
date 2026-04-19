const store = new Map<string, string>();

export default {
  getItem: async (k: string): Promise<string | null> => store.get(k) ?? null,
  setItem: async (k: string, v: string): Promise<void> => {
    store.set(k, v);
  },
  removeItem: async (k: string): Promise<void> => {
    store.delete(k);
  },
  clear: async (): Promise<void> => {
    store.clear();
  },
  /** Test helper — clears in-memory store without async overhead. */
  __reset: (): void => {
    store.clear();
  },
};
