import React, { createContext, useContext, useEffect, useState } from 'react';
import Constants from 'expo-constants';
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
  // True once the rehydrate effect has resolved (either restored a SecureStore
  // session, injected a dev-mode mock, or determined there is nothing to
  // restore). Routes that depend on the auth verdict — e.g. `app/index.tsx`
  // — must wait for `ready` before redirecting, otherwise a stored session
  // user would be sent to the unauthenticated welcome screen and stranded
  // there once rehydration completes.
  ready: boolean;
}

const CustomerAuthBootstrapContext = createContext<CustomerAuthBootstrapValue>({ ready: false });

export function useCustomerAuthBootstrap(): CustomerAuthBootstrapValue {
  return useContext(CustomerAuthBootstrapContext);
}

export function CustomerAuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setSession = useCustomerSessionStore((s) => s.setSession);
  const tenant = useTenantStore((s) => s.tenant);
  const tenantError = useTenantStore((s) => s.error);
  const devAuth = Boolean(Constants.expoConfig?.extra?.['devAuth']);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // If tenant boot failed, unblock the route gate so the app can render an
    // error state rather than spinning forever.
    if (tenantError !== null) {
      setReady(true);
      return;
    }
    // Wait for tenant to resolve before attempting rehydrate / dev-mode inject —
    // both branches require `tenant.id`.
    if (tenant === null) return;

    let cancelled = false;
    (async (): Promise<void> => {
      try {
        // 1. Try to rehydrate from SecureStore (would only be set after a previous
        //    dev-mode boot OR after real customer auth ships in EPIC7-S1).
        const persisted = await loadSecureSession();
        if (cancelled) return;
        if (persisted) {
          const isDevMock = persisted.bearer.startsWith(DEV_MOCK_BEARER_PREFIX);
          // A persisted DEV-MOCK session must NOT survive a flag flip from
          // devAuth=1 to devAuth=0 — that would bypass the documented Phone
          // OTP placeholder mode. Real customer auth (EPIC7-S1) will use a
          // non-DEV-MOCK bearer shape that legitimately survives without the
          // dev flag.
          if (isDevMock && !devAuth) {
            await clearSecureSession();
            // Fall through to the dev-mode-injection branch (which will no-op
            // because devAuth is false).
          } else if (persisted.shopId === tenant.id) {
            setSession(
              { id: persisted.customerId, shopId: persisted.shopId, name: DEV_MOCK_CUSTOMER_NAME, phoneE164: DEV_MOCK_CUSTOMER_PHONE },
              persisted.bearer,
            );
            return;
          }
        }

        // 2. Dev-mode mock — only fires when EXPO_PUBLIC_DEV_AUTH=1.
        if (devAuth) {
          const bearer = buildDevMockBearer();
          const customer = buildDevMockCustomer(tenant);
          await saveSecureSession({ bearer, customerId: customer.id, shopId: customer.shopId });
          if (cancelled) return;
          setSession(customer, bearer);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, [devAuth, tenant, tenantError, setSession]);

  return (
    <CustomerAuthBootstrapContext.Provider value={{ ready }}>
      {children}
    </CustomerAuthBootstrapContext.Provider>
  );
}
