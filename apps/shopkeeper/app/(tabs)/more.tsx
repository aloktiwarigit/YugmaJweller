import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { t } from '@goldsmith/i18n';
import { typography, spacing } from '@goldsmith/ui-tokens';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeTokens } from '../../src/hooks/useThemeTokens';
import { useLocaleStore } from '../../src/stores/localeStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuRow {
  labelKey: string;
  icon: IoniconName;
  href: string;
  managerOnly: boolean;
}

const ROWS: MenuRow[] = [
  { labelKey: 'dashboard.more.customers', icon: 'people-outline', href: '/customers', managerOnly: true },
  { labelKey: 'dashboard.more.custom_orders', icon: 'construct-outline', href: '/custom-orders', managerOnly: true },
  { labelKey: 'dashboard.more.try_at_home', icon: 'home-outline', href: '/try-at-home', managerOnly: true },
  { labelKey: 'dashboard.more.reviews', icon: 'star-outline', href: '/reviews', managerOnly: true },
  { labelKey: 'dashboard.more.rate_lock', icon: 'lock-closed-outline', href: '/rate-lock', managerOnly: true },
  { labelKey: 'dashboard.more.settings', icon: 'settings-outline', href: '/settings', managerOnly: true },
];

export default function MoreScreen(): React.ReactElement {
  const colors = useThemeTokens();
  const role = useAuthStore((s) => s.user?.role);
  useLocaleStore((s) => s.locale);
  const isStaff = role === 'shop_staff';
  const visibleRows = ROWS.filter((r) => !r.managerOnly || !isStaff);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.inkMute }]}>
          {t('dashboard.more.section')}
        </Text>
      </View>
      {visibleRows.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.inkMute }]}>
            {t('dashboard.more.staff_empty')}
          </Text>
        </View>
      ) : visibleRows.map((row) => {
        const label = t(row.labelKey);
        return (
          <Pressable
            key={row.href}
            testID={`more-row-${row.href.replace('/', '')}`}
            onPress={() => router.push(row.href as never)}
            style={[
              styles.row,
              { borderBottomColor: colors.border, backgroundColor: colors.primaryLight },
            ]}
          >
            <View style={styles.rowLeft}>
              <Ionicons name={row.icon} size={24} color={colors.primary} />
              <Text style={[styles.rowLabel, { color: colors.ink }]}>{label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkMute} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: typography.body.family,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    fontFamily: typography.body.family,
    fontSize: 18,
    marginLeft: spacing.md,
  },
  emptyState: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontFamily: typography.body.family,
    fontSize: 16,
  },
});
