import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { InventorySearch } from '../../src/features/inventory/components/InventorySearch';

export default function BillingBarcodeScanScreen(): JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>बारकोड खोज</Text>
        <Text style={styles.subtitle}>लेबल बारकोड, SKU या HUID दर्ज करें।</Text>
      </View>
      <View style={styles.searchPanel}>
        <InventorySearch
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onProductPress={(productId) => router.replace(`/billing/new?productId=${productId}` as any)}
        />
      </View>
      <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.backText}>वापस</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: typography.headingMid.family,
    color: colors.ink,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 15,
    fontFamily: typography.body.family,
    color: colors.inkMute,
  },
  searchPanel: {
    flex: 1,
  },
  backButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  backText: {
    color: colors.ink,
    fontWeight: '700',
    fontFamily: typography.body.family,
  },
});
