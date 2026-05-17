import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import Constants from 'expo-constants';
import auth from '@react-native-firebase/auth';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { useTenantStore } from '../stores/tenantStore';
import { clearSecureSession, saveSecureSession } from '../lib/secure-storage';
import { DEV_MOCK_BEARER_PREFIX } from '../lib/dev-mock-session';

const baseURL =
  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3001';

export const api: AxiosInstance = axios.create({ baseURL, timeout: 15_000 });

type AuthRetryConfig = InternalAxiosRequestConfig & { _authRetry?: boolean };

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

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AuthRetryConfig | undefined;
    if (error.response?.status !== 401 || !original || original._authRetry) {
      throw error;
    }

    const currentBearer = useCustomerSessionStore.getState().bearer;
    const devAuth = Boolean(Constants.expoConfig?.extra?.['devAuth']);
    if (devAuth && currentBearer?.startsWith(DEV_MOCK_BEARER_PREFIX)) {
      throw error;
    }

    original._authRetry = true;
    try {
      const firebaseUser = auth().currentUser;
      if (!firebaseUser) {
        useCustomerSessionStore.getState().clear();
        await clearSecureSession();
        throw error;
      }

      const bearer = await firebaseUser.getIdToken(true);
      const tenant = useTenantStore.getState().tenant;
      const customer = useCustomerSessionStore.getState().customer;
      useCustomerSessionStore.setState({ bearer });
      if (tenant && customer) {
        await saveSecureSession({ bearer, customerId: customer.id, shopId: tenant.id });
      }
      original.headers.set('Authorization', `Bearer ${bearer}`);
      return api.request(original);
    } catch {
      useCustomerSessionStore.getState().clear();
      await clearSecureSession();
      throw error;
    }
  },
);
