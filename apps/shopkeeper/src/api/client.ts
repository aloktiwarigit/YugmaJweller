import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import Constants from 'expo-constants';
import { getIdToken } from '@goldsmith/auth-client';

const baseURL =
  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3000';

export const api: AxiosInstance = axios.create({ baseURL, timeout: 15_000 });

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getIdToken(false);
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  __retriedForClaim?: boolean;
}

api.interceptors.response.use(undefined, async (err: AxiosError<{ code?: string }>) => {
  const res = err.response;
  const original = err.config as RetriableConfig | undefined;
  // Claim-missing (backend signals custom claims haven't propagated yet) — retry ONCE with forced refresh.
  if (
    res?.status === 401 &&
    res.data?.code === 'auth.claim_missing' &&
    original &&
    original.__retriedForClaim !== true
  ) {
    original.__retriedForClaim = true;
    const fresh = await getIdToken(true);
    if (fresh && original.headers) {
      original.headers.set('Authorization', `Bearer ${fresh}`);
    }
    return api.request(original);
  }
  return Promise.reject(err);
});
