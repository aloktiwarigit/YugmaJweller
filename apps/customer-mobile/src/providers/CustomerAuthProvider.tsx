import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import Constants from 'expo-constants';
import auth from '@react-native-firebase/auth';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { useTenantStore } from '../stores/tenantStore';
import { saveSecureSession, loadSecureSession, clearSecureSession } from '../lib/secure-storage';
import {
  DEV_MOCK_BEARER_PREFIX,
  DEV_MOCK_CUSTOMER_NAME,
  DEV_MOCK_CUSTOMER_PHONE,
  buildDevMockBearer,
  buildDevMockCustomer,
} from '../lib/dev-mock-session';
import { identifyPostHog } from '../lib/posthog';

interface CustomerAuthBootstrapValue {
  ready: boolean;
}

const CustomerAuthBootstrapContext = createContext<CustomerAuthBootstrapValue>({ ready: false });

export function useCustomerAuthBootstrap(): CustomerAuthBootstrapValue {
  return useContext(CustomerAuthBootstrapContext);
}

const baseURL =
  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3001';

interface SessionResponse {
  customer:     { id: string; name: string; phoneE164: string | null; email: string | null };
  isNewUser:    boolean;
  authProvider: 'phone' | 'google' | 'email_password';
}

async function callSessionEndpoint(idToken: string, tenantScope: string): Promise<SessionResponse> {
  const resp = await axios.post<SessionResponse>(
    `${baseURL}/api/v1/customer/auth/session`,
    {},
    {
      headers: { Authorization: `Bearer ${idToken}`, 'x-tenant-id': tenantScope },
      timeout: 15_000,
    },
  );
  return resp.data;
}

export function CustomerAuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setSession   = useCustomerSessionStore((s) => s.setSession);
  const clearSession = useCustomerSessionStore((s) => s.clear);
  const tenant       = useTenantStore((s) => s.tenant);
  const tenantError  = useTenantStore((s) => s.error);
  const devAuth      = Boolean(Constants.expoConfig?.extra?.['devAuth']);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (tenantError !== null) {
      setReady(true);
      return;
    }
    if (tenant === null) return;

    // ── Dev mock path (EXPO_PUBLIC_DEV_AUTH=1, never in production) ─────────────
    if (devAuth) {
      let cancelled = false;
      (async (): Promise<void> => {
        try {
          const persisted = await loadSecureSession();
          if (cancelled) return;
          if (persisted?.bearer.startsWith(DEV_MOCK_BEARER_PREFIX) && persisted.shopId === tenant.id) {
            setSession(
              { id: persisted.customerId, shopId: persisted.shopId,
                name: DEV_MOCK_CUSTOMER_NAME, phoneE164: DEV_MOCK_CUSTOMER_PHONE, email: null },
              persisted.bearer,
            );
            void identifyPostHog(DEV_MOCK_CUSTOMER_PHONE, persisted.shopId);
            return;
          }
          const bearer   = buildDevMockBearer();
          const customer = buildDevMockCustomer(tenant);
          await saveSecureSession({ bearer, customerId: customer.id, shopId: customer.shopId });
          if (cancelled) return;
          setSession({ ...customer, email: null }, bearer);
          void identifyPostHog(DEV_MOCK_CUSTOMER_PHONE, customer.shopId);
        } finally {
          if (!cancelled) setReady(true);
        }
      })();
      return (): void => { cancelled = true; };
    }

    // ── Production Firebase auth path ────────────────────────────────────────────
    // onAuthStateChanged fires at app start, sign-in, and sign-out. We avoid
    // onIdTokenChanged here because reading the token inside that listener can
    // create a noisy native token-listener loop on Android. Token refresh is
    // still handled by the API 401 interceptor in src/api/client.ts.
    let bootstrapped = false;

    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          // Clear any stale session (including stale DEV-MOCK sessions from prior dev runs).
          const persisted = await loadSecureSession();
          if (persisted) {
            await clearSecureSession();
          }
          clearSession();
          return;
        }

        // Force-refresh only on first load; subsequent 401s use the api interceptor.
        const idToken = await firebaseUser.getIdToken(!bootstrapped);

        // Call the session endpoint to provision/resolve the DB customer record.
        // Source of truth for DB UUID — do NOT use firebaseUser.uid as customerId.
        const session = await callSessionEndpoint(idToken, tenant.id);
        const { customer: dbCustomer, isNewUser, authProvider } = session;

        await saveSecureSession({
          bearer:     idToken,
          customerId: dbCustomer.id,  // DB UUID, not Firebase UID
          shopId:     tenant.id,
        });

        const isNewOAuth = isNewUser && authProvider !== 'phone';
        setSession(
          {
            id:        dbCustomer.id,
            shopId:    tenant.id,
            name:      dbCustomer.name,
            phoneE164: dbCustomer.phoneE164,
            email:     dbCustomer.email,
          },
          idToken,
          isNewOAuth,
        );
        void identifyPostHog(dbCustomer.phoneE164 ?? dbCustomer.email ?? dbCustomer.id, tenant.id);
      } finally {
        if (!bootstrapped) {
          bootstrapped = true;
          setReady(true);
        }
      }
    });

    // Safety net: mark ready after 5s if Firebase hasn't responded (cold start / no network)
    const fallback = setTimeout(() => {
      if (!bootstrapped) {
        bootstrapped = true;
        setReady(true);
      }
    }, 5000);

    return (): void => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [devAuth, tenant, tenantError, setSession, clearSession]);

  return (
    <CustomerAuthBootstrapContext.Provider value={{ ready }}>
      {children}
    </CustomerAuthBootstrapContext.Provider>
  );
}
