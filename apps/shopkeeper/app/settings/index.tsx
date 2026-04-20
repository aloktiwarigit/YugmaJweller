import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';

const items = [
  { key: 'shop_profile', label: 'शॉप प्रोफाइल', route: '/settings/shop-profile' },
  { key: 'staff', label: 'स्टाफ प्रबंधन', route: '/settings/staff' },
  { key: 'making_charges', label: 'मेकिंग चार्जेस', route: '/settings/making-charges' },
  { key: 'loyalty', label: 'लॉयल्टी प्रोग्राम', route: '/settings/loyalty' },
  { key: 'billing', label: 'बिलिंग', route: '/settings/billing' },
  { key: 'reports', label: 'रिपोर्ट्स', route: '/settings/reports' },
] as const;

export default function SettingsScreen(): React.ReactElement {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>सेटिंग्स</Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          testID={`settings-item-${item.key}`}
          style={styles.row}
          onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: typography.display.family,
    color: colors.ink,
    padding: spacing.md,
    paddingTop: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: typography.body.family,
    color: colors.ink,
  },
  arrow: {
    fontSize: 20,
    color: colors.inkMute,
  },
});
