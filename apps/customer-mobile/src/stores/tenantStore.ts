import { create } from 'zustand';

export interface TenantBranding {
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  appName?: string;
  defaultLanguage?: 'hi-IN' | 'en-IN';
}

export interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  branding: TenantBranding;
}

export interface TenantState {
  slug: string | null;
  tenant: Tenant | null;
  etag: string | null;
  loading: boolean;
  error: string | null;
  retryNonce: number;
  setSlug: (s: string | null) => void;
  setTenant: (t: Tenant | null, etag: string | null) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  retryBoot: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  slug: null,
  tenant: null,
  etag: null,
  loading: true,
  error: null,
  retryNonce: 0,
  setSlug: (s): void => set({ slug: s }),
  setTenant: (t, etag): void => set({ tenant: t, etag, loading: false, error: null }),
  setLoading: (b): void => set(b ? { loading: b, error: null } : { loading: b }),
  setError: (e): void => set({ error: e, loading: false }),
  retryBoot: (): void => set((state) => ({ retryNonce: state.retryNonce + 1, loading: true, error: null })),
}));
