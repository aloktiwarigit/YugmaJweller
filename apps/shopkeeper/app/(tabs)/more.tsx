import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { useAuthStore } from '../../src/stores/authStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuRow {
  label:     string;
  icon:      IoniconName;
  href:      string;
  ownerOnly: boolean;
}

const ROWS: MenuRow[] = [
  { label: 'ग्राहक सूची',   icon: 'people-outline',      href: '/customers',     ownerOnly: false },
  { label: 'कस्टम ऑर्डर',  icon: 'construct-outline',   href: '/custom-orders', ownerOnly: false },
  { label: 'ट्राई-एट-होम', icon: 'home-outline',         href: '/try-at-home',   ownerOnly: false },
  { label: 'दर-लॉक बुकिंग', icon: 'lock-closed-outline', href: '/rate-lock',     ownerOnly: true  },
];

export default function MoreScreen(): React.ReactElement {
  const role        = useAuthStore((s) => s.user?.role);
  const isStaff     = role === 'shop_staff';
  const visibleRows = ROWS.filter((r) => !r.ownerOnly || !isStaff);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>दैनिक संचालन</Text>
      </View>
      {visibleRows.map((row) => (
        <Pressable
          key={row.href}
          testID={`more-row-${row.href.replace('/', '')}`}
          onPress={() => router.push(row.href as never)}
          style={styles.row}
        >
          <View style={styles.rowLeft}>
            <Ionicons name={row.icon} size={24} color={colors.primary} />
            <Text style={styles.rowLabel}>{row.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.inkMute} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xl },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },
  sectionLabel: {
    fontFamily:    typography.body.family,
    fontSize:      13,
    color:         colors.inkMute,
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
    borderBottomColor: colors.border,
    backgroundColor:   colors.white,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  rowLabel: {
    fontFamily: typography.body.family,
    fontSize:   18,
    color:      colors.ink,
    marginLeft: spacing.md,
  },
});
