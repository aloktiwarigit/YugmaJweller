import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Button } from '@goldsmith/ui-mobile';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSessionStore } from '../../src/stores/customerSessionStore';
import { useTenantStore } from '../../src/stores/tenantStore';
import { saveSecureSession } from '../../src/lib/secure-storage';
import { buildDevMockBearer, buildDevMockCustomer } from '../../src/lib/dev-mock-session';

export default function Welcome(): React.ReactElement {
  const devAuth = Boolean(Constants.expoConfig?.extra?.['devAuth']);
  const setSession = useCustomerSessionStore((s) => s.setSession);
  const tenant = useTenantStore((s) => s.tenant);

  const onDevContinue = async (): Promise<void> => {
    if (!tenant) return;
    const bearer = buildDevMockBearer();
    const customer = buildDevMockCustomer(tenant);
    await saveSecureSession({ bearer, customerId: customer.id, shopId: customer.shopId });
    setSession(customer, bearer);
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: typography.display.family,
            fontSize: 28,
            color: colors.ink,
            marginBottom: spacing.sm,
          }}
        >
          स्वागत है
        </Text>
        <Text
          style={{
            fontFamily: typography.serif.family,
            fontSize: 16,
            color: colors.inkMute,
            marginBottom: spacing.xl,
          }}
        >
          फ़ोन OTP लॉगिन जल्द आ रहा है। (Phone OTP login coming soon.)
        </Text>

        {devAuth ? (
          <Button
            label="जारी रखें (Dev)"
            variant="primary"
            onPress={onDevContinue}
            testID="welcome-dev-continue"
          />
        ) : null}
      </View>
    </View>
  );
}
