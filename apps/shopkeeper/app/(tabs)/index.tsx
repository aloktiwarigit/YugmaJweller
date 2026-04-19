import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { t } from '@goldsmith/i18n';
import { Button, Skeleton, Toast } from '@goldsmith/ui-mobile';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { useTenantStore } from '../../src/stores/tenantStore';

export default function DashboardScreen(): React.ReactElement {
  const router = useRouter();
  const tenant = useTenantStore((s) => s.tenant);
  const loading = useTenantStore((s) => s.loading);
  const [stubMsg, setStubMsg] = useState<string | null>(null);

  const showStub = (): void => {
    setStubMsg(t('dashboard.stub_story_1_2'));
    setTimeout(() => setStubMsg(null), 3000);
  };

  const isLoading = loading || tenant === null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
      }}
    >
      {/* Top bar: logo placeholder + jeweller display name + settings stub */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.xl,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isLoading ? (
            <Skeleton height={40} width={40} testID="dashboard-skeleton-logo" />
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: colors.border,
                marginRight: spacing.sm,
              }}
            />
          )}
          <View style={{ marginLeft: spacing.sm }}>
            {isLoading ? (
              <Skeleton height={20} width={160} testID="dashboard-skeleton-name" />
            ) : (
              <Text
                style={{
                  fontFamily: typography.display.family,
                  fontSize: 20,
                  color: colors.ink,
                }}
              >
                {tenant!.displayName}
              </Text>
            )}
          </View>
        </View>
        {/* Settings icon stub (non-functional) */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            backgroundColor: colors.border,
          }}
        />
      </View>

      {/* Hero section */}
      {isLoading ? (
        <View>
          <Skeleton height={16} width={120} testID="dashboard-skeleton-eyebrow" />
          <View style={{ marginTop: spacing.sm }}>
            <Skeleton height={32} width={280} testID="dashboard-skeleton-headline" />
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <Skeleton height={20} width={240} testID="dashboard-skeleton-subcopy" />
          </View>
        </View>
      ) : (
        <View>
          {/* Eyebrow — Mukta Vaani smallcaps style via letter-spacing */}
          <Text
            style={{
              fontFamily: typography.headingMid.family,
              fontSize: 13,
              color: colors.primary,
              letterSpacing: 3,
              textTransform: 'uppercase',
              marginBottom: spacing.xs,
            }}
          >
            {t('dashboard.eyebrow')}
          </Text>

          {/* Headline — Yatra One display */}
          <Text
            style={{
              fontFamily: typography.display.family,
              fontSize: 30,
              color: colors.ink,
              lineHeight: 38,
              marginBottom: spacing.sm,
            }}
          >
            {t('dashboard.headline')}
          </Text>

          {/* Subcopy — Tiro Devanagari serif */}
          <Text
            style={{
              fontFamily: typography.serif.family,
              fontSize: 18,
              color: colors.inkMute,
              marginBottom: spacing.xl,
            }}
          >
            {t('dashboard.subcopy')}
          </Text>

          {/* Two CTAs stacked with 16pt gap */}
          <Button
            label={t('dashboard.cta_staff')}
            variant="primary"
            onPress={() => router.push('/settings/staff')}
            testID="dashboard-cta-staff"
          />
          <View style={{ height: 16 }} />
          <Button
            label={t('dashboard.cta_settings')}
            variant="secondary"
            onPress={showStub}
            testID="dashboard-cta-settings"
          />
        </View>
      )}

      {/* Stub toast */}
      {stubMsg !== null && (
        <View style={{ marginTop: spacing.lg }}>
          <Toast message={stubMsg} variant="info" testID="dashboard-stub-toast" />
        </View>
      )}
    </View>
  );
}
