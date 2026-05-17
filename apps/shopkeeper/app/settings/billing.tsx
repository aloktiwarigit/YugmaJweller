import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';

const LINKS = [
  { label: 'Making charges', href: '/settings/making-charges', icon: 'cash-outline' },
  { label: 'Wastage rules', href: '/settings/wastage', icon: 'scale-outline' },
  { label: 'Return policy', href: '/settings/return-policy', icon: 'return-up-back-outline' },
  { label: 'Custom order policy', href: '/settings/custom-order-policy', icon: 'construct-outline' },
] as const;

export default function BillingSettingsScreen(): React.ReactElement {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="billing-settings-screen">
      <Text style={styles.title}>Billing settings</Text>
      <Text style={styles.subtitle}>Configure the rules used by invoices, estimates, returns, and deposits.</Text>
      <View style={styles.list}>
        {LINKS.map((link) => (
          <Pressable
            key={link.href}
            style={styles.row}
            onPress={() => router.push(link.href as Parameters<typeof router.push>[0])}
            accessibilityRole="button"
            accessibilityLabel={link.label}
          >
            <View style={styles.rowLeft}>
              <Ionicons name={link.icon} size={22} color={colors.primaryDeep} />
              <Text style={styles.rowLabel}>{link.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.inkMute} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: {
    fontSize: 22,
    fontFamily: typography.headingMid.family,
    fontWeight: '700',
    color: colors.ink,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: typography.body.family,
    color: colors.inkMute,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.sm },
  row: {
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabel: {
    fontSize: 16,
    fontFamily: typography.body.family,
    fontWeight: '700',
    color: colors.ink,
  },
});
