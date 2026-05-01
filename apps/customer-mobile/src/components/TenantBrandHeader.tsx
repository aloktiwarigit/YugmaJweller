import React from 'react';
import { View, Text, Image } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { useTenantStore } from '../stores/tenantStore';

export function TenantBrandHeader(): React.ReactElement | null {
  const tenant = useTenantStore((s) => s.tenant);
  const loading = useTenantStore((s) => s.loading);

  if (loading || !tenant) return null;

  const logoUrl = tenant.branding.logoUrl;

  return (
    <View
      testID="tenant-brand-header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.bg,
      }}
    >
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          style={{ width: 40, height: 40, borderRadius: 8, marginRight: spacing.sm }}
          accessibilityLabel={tenant.displayName}
        />
      ) : (
        <View
          accessible={false}
          importantForAccessibility="no"
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: colors.border,
            marginRight: spacing.sm,
          }}
        />
      )}
      <Text
        testID="tenant-brand-name"
        style={{
          fontFamily: typography.display.family,
          fontSize: 20,
          color: colors.ink,
        }}
      >
        {tenant.displayName}
      </Text>
    </View>
  );
}
