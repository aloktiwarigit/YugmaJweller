import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import Constants from 'expo-constants';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { useTenantStore } from '../stores/tenantStore';

const baseURL =
  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3000';

export const api: AxiosInstance = axios.create({ baseURL, timeout: 15_000 });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tenant = useTenantStore.getState().tenant;
  if (tenant) {
    config.headers.set('x-tenant-id', tenant.id);
  }
  const bearer = useCustomerSessionStore.getState().bearer;
  if (bearer) {
    config.headers.set('Authorization', `Bearer ${bearer}`);
  }
  return config;
});
