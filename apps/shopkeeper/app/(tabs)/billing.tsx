import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@goldsmith/ui-tokens';
import { useThemeTokens } from '../../src/hooks/useThemeTokens';

export default function BillingScreen(): React.ReactElement {
  const colors = useThemeTokens();

  const items = [
    { label: 'नया बिल', route: '/billing/new', icon: 'receipt-outline' },
    { label: 'अनुमान', route: '/billing/estimate', icon: 'document-text-outline' },
    { label: 'पुराना सोना खरीद', route: '/billing/urd-exchange', icon: 'swap-horizontal-outline' },
    { label: 'बारकोड स्कैन', route: '/billing/scan', icon: 'barcode-outline' },
  ] as const;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.ink }]}>बिलिंग</Text>
      <Text style={[styles.subtitle, { color: colors.inkMute }]}>
        बिल, अनुमान, स्कैन और पुराने सोने की खरीद के काम।
      </Text>

      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.route}
            style={({ pressed }) => [
              styles.card,
              {
                borderColor: colors.border,
                backgroundColor: pressed ? colors.bg : colors.white,
              },
            ]}
            onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <Ionicons name={item.icon} size={24} color={colors.primary} />
            <Text style={[styles.cardText, { color: colors.ink }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: typography.display.family,
    fontSize: 26,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.body.family,
    fontSize: 16,
    marginBottom: spacing.lg,
  },
  grid: {
    gap: spacing.md,
  },
  card: {
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardText: {
    fontFamily: typography.body.family,
    fontSize: 17,
    fontWeight: '600',
  },
});
