import React from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { colors } from '@goldsmith/ui-tokens';

export default function Index(): React.ReactElement {
  const loading = useAuthStore((s) => s.loading);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const user = useAuthStore((s) => s.user);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  // firebaseUser alone is not sufficient — user is populated only after successful /auth/session,
  // so firebaseUser && user guarantees a fully provisioned session.
  if (firebaseUser && user) {
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href="/(auth)/phone" />;
}
