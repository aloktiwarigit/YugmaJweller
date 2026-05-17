import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { typography, spacing } from '@goldsmith/ui-tokens';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeTokens } from '../../src/hooks/useThemeTokens';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuRow {
  label:     string;
  icon:      IoniconName;
  href:      string;
  managerOnly: boolean;
}

const ROWS: MenuRow[] = [
  { label: 'ग्राहक सूची',   icon: 'people-outline',      href: '/customers',     managerOnly: true },
  { label: 'कस्टम ऑर्डर',  icon: 'construct-outline',   href: '/custom-orders', managerOnly: true },
  { label: 'ट्राई-एट-होम', icon: 'home-outline',         href: '/try-at-home',   managerOnly: true },
  { label: 'दर-लॉक बुकिंग', icon: 'lock-closed-outline', href: '/rate-lock',     managerOnly: true },
  { label: 'सेटिंग्स',      icon: 'settings-outline',    href: '/settings',      managerOnly: true },
];

export default function MoreScreen(): React.ReactElement {
  const colors      = useThemeTokens();
  const role        = useAuthStore((s) => s.user?.role);
  const isStaff     = role === 'shop_staff';
  const visibleRows = ROWS.filter((r) => !r.managerOnly || !isStaff);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.inkMute }]}>दैनिक संचालन</Text>
      </View>
      {visibleRows.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.inkMute }]}>
            स्टाफ की पहुंच बिलिंग और इन्वेंटरी तक सीमित है।
          </Text>
        </View>
      ) : visibleRows.map((row) => (
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
            <Text style={[styles.rowLabel, { color: colors.ink }]}>{row.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.inkMute} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { paddingBottom: spacing.xl },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },
  sectionLabel: {
    fontFamily:    typography.body.family,
    fontSize:      13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    minHeight:         64,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  rowLabel: {
    fontFamily: typography.body.family,
    fontSize:   18,
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
