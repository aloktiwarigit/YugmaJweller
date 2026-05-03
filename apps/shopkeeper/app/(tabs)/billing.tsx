import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';

export default function BillingScreen(): React.ReactElement {
  const items = [
    { label: 'नया invoice', route: '/billing/new', icon: 'receipt-outline' },
    { label: 'अनुमान', route: '/billing/estimate', icon: 'document-text-outline' },
    { label: 'पुराना सोना खरीद', route: '/billing/urd-exchange', icon: 'swap-horizontal-outline' },
    { label: 'बारकोड स्कैन', route: '/billing/scan', icon: 'barcode-outline' },
  ] as const;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>बिलिंग</Text>
      <Text style={styles.subtitle}>Invoice, estimate, scan, and old-gold purchase flows.</Text>

      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.route}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <Ionicons name={item.icon} size={24} color={colors.primary} />
            <Text style={styles.cardText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: typography.display.family,
    fontSize: 26,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.inkMute,
    marginBottom: spacing.lg,
  },
  grid: {
    gap: spacing.md,
  },
  card: {
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardPressed: {
    backgroundColor: colors.bg,
  },
  cardText: {
    fontFamily: typography.body.family,
    fontSize: 17,
    color: colors.ink,
    fontWeight: '600',
  },
});
