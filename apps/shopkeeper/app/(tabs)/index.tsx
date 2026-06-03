import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Skeleton } from '@goldsmith/ui-mobile';
import { t } from '@goldsmith/i18n';
import { spacing, typography } from '@goldsmith/ui-tokens';
import { useTenantStore } from '../../src/stores/tenantStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeTokens } from '../../src/hooks/useThemeTokens';
import { useLocaleStore } from '../../src/stores/localeStore';
import { DashboardKpiCard } from '../../src/components/DashboardKpiCard';

type QuickAction = {
  labelKey: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  href: string;
  managerOnly?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  { labelKey: 'dashboard.actions.new_bill', icon: 'receipt-outline', href: '/billing/new' },
  { labelKey: 'dashboard.actions.inventory', icon: 'cube-outline', href: '/inventory' },
  { labelKey: 'dashboard.actions.customers', icon: 'people-outline', href: '/customers', managerOnly: true },
  { labelKey: 'dashboard.actions.custom_orders', icon: 'construct-outline', href: '/custom-orders', managerOnly: true },
  { labelKey: 'dashboard.actions.rate_lock', icon: 'lock-closed-outline', href: '/rate-lock', managerOnly: true },
  { labelKey: 'dashboard.actions.reports', icon: 'bar-chart-outline', href: '/reports', managerOnly: true },
];

export default function DashboardScreen(): React.ReactElement {
  const colors = useThemeTokens();
  const tenant = useTenantStore((s) => s.tenant);
  const loading = useTenantStore((s) => s.loading);
  const role = useAuthStore((s) => s.user?.role);
  useLocaleStore((s) => s.locale);
  const isStaff = role === 'shop_staff';
  const showKpis = process.env['EXPO_PUBLIC_DASHBOARD_KPIS'] === '1' && !isStaff;
  const isLoading = loading || tenant === null;
  const visibleActions = QUICK_ACTIONS.filter((action) => !action.managerOnly || !isStaff);
  const shopInitial = tenant?.displayName?.trim().slice(0, 1).toUpperCase() ?? '';

  return (
    <ScrollView
      style={{ ...styles.screen, backgroundColor: colors.bg }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          {isLoading ? (
            <Skeleton height={44} width={44} testID="dashboard-skeleton-logo" />
          ) : (
            <View style={{ ...styles.logoFallback, backgroundColor: colors.primaryLight }}>
              <Text style={{ ...styles.logoInitial, color: colors.ink }}>{shopInitial}</Text>
            </View>
          )}
          <View style={styles.brandText}>
            {isLoading ? (
              <Skeleton height={20} width={160} testID="dashboard-skeleton-name" />
            ) : (
              <>
                <Text style={{ ...styles.shopName, color: colors.ink }} numberOfLines={1}>
                  {tenant.displayName}
                </Text>
                <Text style={{ ...styles.roleText, color: colors.inkMute }}>
                  {isStaff ? t('dashboard.role.staff_workspace') : t('dashboard.role.shop_operations')}
                </Text>
              </>
            )}
          </View>
        </View>

        {!isStaff ? (
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            testID="dashboard-settings-icon"
            style={styles.iconButton}
          >
            <Ionicons name="settings-outline" size={22} color={colors.inkMute} />
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.loadingBlock}>
          <Skeleton height={48} width={280} testID="dashboard-skeleton-headline" />
          <Skeleton height={88} width={320} testID="dashboard-skeleton-actions" />
        </View>
      ) : (
        <>
          <View style={styles.primaryActions}>
            <Button
              label={t('dashboard.actions.new_bill')}
              variant="primary"
              onPress={() => router.push('/billing/new')}
              testID="dashboard-cta-invoice"
            />
            <View style={{ width: spacing.sm }} />
            <Button
              label={t('dashboard.actions.search_inventory')}
              variant="secondary"
              onPress={() => router.push('/inventory')}
              testID="dashboard-cta-inventory"
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={{ ...styles.sectionTitle, color: colors.ink }}>
              {t('dashboard.section.today')}
            </Text>
            {!isStaff ? (
              <Pressable
                onPress={() => router.push('/settings/staff')}
                accessibilityRole="button"
                testID="dashboard-cta-staff"
              >
                <Text style={{ ...styles.headerLink, color: colors.primary }}>
                  {t('dashboard.actions.staff')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.actionGrid}>
            {visibleActions.map((action) => {
              const label = t(action.labelKey);
              return (
                <Pressable
                  key={action.href}
                  style={{
                    ...styles.actionCard,
                    backgroundColor: colors.white,
                    borderColor: colors.border,
                  }}
                  onPress={() => router.push(action.href as Parameters<typeof router.push>[0])}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <Ionicons name={action.icon} size={22} color={colors.primary} />
                  <Text style={{ ...styles.actionLabel, color: colors.ink }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {showKpis ? <DashboardKpiCard /> : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  brandRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  logoFallback: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  logoInitial: {
    fontFamily: typography.headingMid.family,
    fontSize: 20,
    fontWeight: '700',
  },
  brandText: {
    flex: 1,
    minWidth: 0,
  },
  shopName: {
    fontFamily: typography.display.family,
    fontSize: 20,
  },
  roleText: {
    fontFamily: typography.body.family,
    fontSize: 13,
    marginTop: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBlock: {
    gap: spacing.md,
  },
  primaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    minHeight: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.headingMid.family,
    fontSize: 18,
    fontWeight: '700',
  },
  headerLink: {
    fontFamily: typography.body.family,
    fontSize: 15,
    fontWeight: '700',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionCard: {
    width: '48%',
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  actionLabel: {
    fontFamily: typography.body.family,
    fontSize: 15,
    fontWeight: '700',
  },
});
