import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors } from '@goldsmith/ui-tokens';
import { useCustomerSession } from '../src/hooks/useCustomerSession';
import { useCustomerAuthBootstrap } from '../src/providers/CustomerAuthProvider';

export default function Index(): React.ReactElement {
  const { isAuthenticated } = useCustomerSession();
  const { ready } = useCustomerAuthBootstrap();
  if (!ready) {
    return (
      <View
        testID="auth-bootstrap-loading"
        style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator />
      </View>
    );
  }
  return isAuthenticated ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/welcome" />;
}
