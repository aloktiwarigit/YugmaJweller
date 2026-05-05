import React from 'react';
import { View, ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { RateWidget } from '@goldsmith/ui-mobile';
import { colors, spacing, radii, typography } from '@goldsmith/ui-tokens';
import { usePublicRates } from '../../src/hooks/usePublicRates';
import { InventorySearch } from '../../src/features/inventory/components/InventorySearch';

interface QuickAction {
  label: string;
  href:  string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: '+ नया उत्पाद', href: '/inventory/new'         },
  { label: 'CSV आयात',     href: '/inventory/bulk-import'  },
  { label: 'मूल्यांकन',    href: '/inventory/valuation'    },
  { label: 'डेड स्टॉक',   href: '/inventory/dead-stock'   },
  { label: 'लेबल प्रिंट',  href: '/inventory/print-labels' },
];

export default function InventoryListScreen(): React.ReactElement {
  const { data: rates, isLoading } = usePublicRates();

  return (
    <View style={styles.screen}>
      {/* Live rate compact header */}
      <View style={styles.rateHeader}>
        <RateWidget
          variant="compact"
          rates={rates ?? null}
          loading={isLoading}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push('/rates/history' as any)}
        />
      </View>

      {/* Quick-actions pill bar */}
      <View style={styles.quickActionsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsContent}
        >
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.href}
              testID={`quick-action-${action.href.split('/').pop()}`}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => router.push(action.href as any)}
              style={styles.pill}
            >
              <Text style={styles.pillLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Inventory search + results */}
      <View style={styles.searchContainer}>
        <InventorySearch
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onProductPress={(productId) => router.push(`/inventory/${productId}/edit` as any)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  rateHeader: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  quickActionsWrapper: {
    backgroundColor:   colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical:   spacing.sm,
  },
  quickActionsContent: {
    paddingHorizontal: spacing.md,
  },
  pill: {
    minHeight:         44,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      radii.pill,
    borderWidth:       1,
    borderColor:       colors.border,
    backgroundColor:   colors.white,
    marginRight:       spacing.sm,
    justifyContent:    'center',
  },
  pillLabel: {
    fontFamily: typography.body.family,
    fontSize:   14,
    color:      colors.ink,
  },
  searchContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.md,
  },
});
