import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { useTenantStore } from '../stores/tenantStore';

function brandMarkText(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0];
  if (!firstWord) return '◆';
  if (/^[\u0900-\u097F]+$/.test(firstWord) && firstWord.length <= 6) return firstWord;
  return Array.from(firstWord)[0]?.toLocaleUpperCase() ?? '◆';
}

export function TenantBrandHeader(): React.ReactElement | null {
  const tenant = useTenantStore((s) => s.tenant);
  const loading = useTenantStore((s) => s.loading);
  // Without the top inset the brand text sits directly under the status bar
  // and Devanagari reph + matras (श्री / ज्वैलर्स) get clipped against the
  // notch/status-icon row — verified on Moto G 2026-05-12.
  const insets = useSafeAreaInsets();
  const logoUrl = tenant?.branding.logoUrl;
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  if (loading || !tenant) return null;

  // White-label: customer-facing surfaces show the tenant's configured
  // app name when set (config.app_name → branding.appName). Fall back to
  // displayName, which is the back-office shop name and may differ.
  const customerFacingName = tenant.branding.appName ?? tenant.displayName;

  // React Native Image needs an absolute URI on native. The seeded
  // shops.config.logo_url shape can be a relative path (e.g.
  // `/assets/brand/placeholder-logo.svg`) which would render broken on
  // iOS/Android. Render a tenant monogram fallback when the URL is absent,
  // relative, or fails to load so the header never shows an empty square.
  const hasAbsoluteLogo = typeof logoUrl === 'string' && /^(?:https?:|data:)/.test(logoUrl);
  const showLogoImage = hasAbsoluteLogo && !logoFailed;
  const fallbackMark = brandMarkText(customerFacingName);

  return (
    <View
      testID="tenant-brand-header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.md,
        backgroundColor: colors.bg,
      }}
    >
      {showLogoImage ? (
        <Image
          source={{ uri: logoUrl }}
          style={{ width: 40, height: 40, borderRadius: 8, marginRight: spacing.sm }}
          accessibilityLabel={customerFacingName}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <View
          testID="tenant-brand-fallback-mark"
          accessibilityLabel={`${customerFacingName} ब्रांड चिन्ह`}
          accessibilityRole="image"
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: colors.primaryWash,
            marginRight: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Text
            style={{
              fontFamily: typography.headingMid.family,
              fontSize: fallbackMark.length > 1 ? 13 : 18,
              lineHeight: 22,
              color: colors.primary,
              textAlign: 'center',
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {fallbackMark}
          </Text>
        </View>
      )}
      <Text
        testID="tenant-brand-name"
        style={{
          fontFamily: typography.display.family,
          fontSize: 20,
          // Devanagari needs ~1.4× line-height so reph + ee-matra clear the
          // status bar and the row above. RN's default ~1.2× clipped them.
          lineHeight: 28,
          color: colors.ink,
        }}
      >
        {customerFacingName}
      </Text>
    </View>
  );
}
