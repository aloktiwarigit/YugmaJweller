import React from 'react';
import { View, Text, Image } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { useTenantStore } from '../stores/tenantStore';

export function TenantBrandHeader(): React.ReactElement | null {
  const tenant = useTenantStore((s) => s.tenant);
  const loading = useTenantStore((s) => s.loading);

  if (loading || !tenant) return null;

  // White-label: customer-facing surfaces show the tenant's configured
  // app name when set (config.app_name → branding.appName). Fall back to
  // displayName, which is the back-office shop name and may differ.
  const customerFacingName = tenant.branding.appName ?? tenant.displayName;

  // React Native Image needs an absolute URI on native. The seeded
  // shops.config.logo_url shape can be a relative path (e.g.
  // `/assets/brand/placeholder-logo.svg`) which would render broken on
  // iOS/Android with no fallback. Only render Image when the URL is
  // absolute; otherwise fall through to the neutral placeholder. A
  // follow-up CDN-rewrite story should resolve relative paths against
  // the tenant's CDN origin server-side.
  const logoUrl = tenant.branding.logoUrl;
  const hasAbsoluteLogo = typeof logoUrl === 'string' && /^(?:https?:|data:)/.test(logoUrl);

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
      {hasAbsoluteLogo ? (
        <Image
          source={{ uri: logoUrl }}
          style={{ width: 40, height: 40, borderRadius: 8, marginRight: spacing.sm }}
          accessibilityLabel={customerFacingName}
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
        {customerFacingName}
      </Text>
    </View>
  );
}
