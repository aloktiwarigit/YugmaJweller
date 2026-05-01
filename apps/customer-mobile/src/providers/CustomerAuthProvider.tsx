import React, { useEffect } from 'react';
import Constants from 'expo-constants';
import { useCustomerSessionStore } from '../stores/customerSessionStore';
import { useTenantStore } from '../stores/tenantStore';
import { saveSecureSession, loadSecureSession } from '../lib/secure-storage';

const DEV_MOCK_BEARER_PREFIX = 'DEV-MOCK-';
const DEV_MOCK_CUSTOMER_ID = '00000000-0000-4000-8000-000000000999';

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
          { id: persisted.customerId, shopId: persisted.shopId, name: 'देव-मोड ग्राहक', phoneE164: '+919999999999' },
          persisted.bearer,
        );
        return;
      }

      // 2. Dev-mode mock — only fires when EXPO_PUBLIC_DEV_AUTH=1 AND tenant is resolved.
      if (devAuth && tenant) {
        const bearer = `${DEV_MOCK_BEARER_PREFIX}${Date.now()}`;
        const customer = {
          id: DEV_MOCK_CUSTOMER_ID,
          shopId: tenant.id,
          name: 'देव-मोड ग्राहक',
          phoneE164: '+919999999999',
        };
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
