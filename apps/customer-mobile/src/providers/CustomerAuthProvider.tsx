import React, { createContext, useContext, useEffect, useState } from 'react';
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

interface CustomerAuthBootstrapValue {
  ready: boolean;
}

const CustomerAuthBootstrapContext = createContext<CustomerAuthBootstrapValue>({ ready: false });

export function useCustomerAuthBootstrap(): CustomerAuthBootstrapValue {
  return useContext(CustomerAuthBootstrapContext);
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
              { id: persisted.customerId, shopId: persisted.shopId, name: DEV_MOCK_CUSTOMER_NAME, phoneE164: DEV_MOCK_CUSTOMER_PHONE },
              persisted.bearer,
            );
            return;
          }
          const bearer   = buildDevMockBearer();
          const customer = buildDevMockCustomer(tenant);
          await saveSecureSession({ bearer, customerId: customer.id, shopId: customer.shopId });
          if (cancelled) return;
          setSession(customer, bearer);
        } finally {
          if (!cancelled) setReady(true);
        }
      })();
      return (): void => { cancelled = true; };
    }

    // ── Production Firebase auth path ────────────────────────────────────────────
    // onIdTokenChanged fires at app start, sign-in/sign-out, and token refresh.
    // When a user is authenticated the current ID token is used as the API bearer.
    // The API guard (customer-auth.guard.ts) verifies the token server-side and
    // resolves the customer record by phone + shop_id.
    let bootstrapped = false;

    const unsubscribe = auth().onIdTokenChanged(async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          // Clear any stale session (including stale DEV-MOCK sessions from prior dev runs).
          // When devAuth is false we are in production Firebase auth path; any persisted
          // bearer — real or mock — is invalid without a live Firebase user.
          const persisted = await loadSecureSession();
          if (persisted) {
            await clearSecureSession();
          }
          clearSession();
          return;
        }

        // Force-refresh only on first load; subsequent calls reuse cached token.
        const idToken = await firebaseUser.getIdToken(!bootstrapped);
        const phone   = firebaseUser.phoneNumber ?? '';

        await saveSecureSession({
          bearer:     idToken,
          customerId: firebaseUser.uid,
          shopId:     tenant.id,
        });

        setSession(
          { id: firebaseUser.uid, shopId: tenant.id, name: phone, phoneE164: phone },
          idToken,
        );
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
