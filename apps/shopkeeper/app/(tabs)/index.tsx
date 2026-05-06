import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@goldsmith/i18n';
import { Button, Skeleton, Toast } from '@goldsmith/ui-mobile';
import { typography, spacing } from '@goldsmith/ui-tokens';
import { useTenantStore } from '../../src/stores/tenantStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeTokens } from '../../src/hooks/useThemeTokens';
import { DashboardKpiCard } from '../../src/components/DashboardKpiCard';

export default function DashboardScreen(): React.ReactElement {
  const colors  = useThemeTokens();
  const tenant  = useTenantStore((s) => s.tenant);
  const loading = useTenantStore((s) => s.loading);
  const role    = useAuthStore((s) => s.user?.role);
  const showKpis = process.env['EXPO_PUBLIC_DASHBOARD_KPIS'] === '1' && role !== 'shop_staff';

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
        {/* Settings icon — navigates to settings tab */}
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="सेटिंग्स"
          testID="dashboard-settings-icon"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 8 }}
        >
          <Ionicons name="settings-outline" size={24} color={colors.inkMute} />
        </Pressable>
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
            onPress={() => router.push('/settings')}
            testID="dashboard-cta-settings"
          />
        </View>
      )}

      {/* Flag-gated KPI card — admin/manager only when EXPO_PUBLIC_DASHBOARD_KPIS=1 */}
      {showKpis && <DashboardKpiCard />}
    </View>
  );
}
