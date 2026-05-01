import React, { useEffect } from 'react';
import Constants from 'expo-constants';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { useTenantStore } from '../stores/tenantStore';
import { saveSecureSession, loadSecureSession } from '../lib/secure-storage';
import {
  DEV_MOCK_CUSTOMER_NAME,
  DEV_MOCK_CUSTOMER_PHONE,
  buildDevMockBearer,
  buildDevMockCustomer,
} from '../lib/dev-mock-session';

export function CustomerAuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setSession = useCustomerSessionStore((s) => s.setSession);
  const tenant = useTenantStore((s) => s.tenant);
  const devAuth = Boolean(Constants.expoConfig?.extra?.['devAuth']);

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      // 1. Try to rehydrate from SecureStore (would only be set after a previous dev-mode boot
      //    OR after real customer auth ships in EPIC7-S1).
      const persisted = await loadSecureSession();
      if (cancelled) return;
      if (persisted && tenant && persisted.shopId === tenant.id) {
        setSession(
          { id: persisted.customerId, shopId: persisted.shopId, name: DEV_MOCK_CUSTOMER_NAME, phoneE164: DEV_MOCK_CUSTOMER_PHONE },
          persisted.bearer,
        );
        return;
      }

      // 2. Dev-mode mock — only fires when EXPO_PUBLIC_DEV_AUTH=1 AND tenant is resolved.
      if (devAuth && tenant) {
        const bearer = buildDevMockBearer();
        const customer = buildDevMockCustomer(tenant);
        await saveSecureSession({ bearer, customerId: customer.id, shopId: customer.shopId });
        if (cancelled) return;
        setSession(customer, bearer);
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, [devAuth, tenant, setSession]);

  return <>{children}</>;
}
