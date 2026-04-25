import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { api } from '../../../src/api/client';
import { MovementTypeChip } from '../../../src/features/inventory/components/MovementTypeChip';
import { RecordMovementModal } from '../../../src/features/inventory/components/RecordMovementModal';
import type { StockMovementResponse } from '@goldsmith/shared';

export default function MovementsScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['stockMovements', id],
    queryFn: async (): Promise<StockMovementResponse[]> => {
      const res = await api.get<StockMovementResponse[]>(
        `/api/v1/inventory/products/${id}/movements`,
      );
      return res.data;
    },
    enabled: !!id,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>आंदोलन इतिहास</Text>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : null}
      {error ? <Text style={styles.errorText}>लोड नहीं हो सका</Text> : null}

      <FlatList
        data={data ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading && !error ? (
            <Text style={styles.empty}>अभी कोई आंदोलन नहीं</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row} accessible accessibilityLabel={`${item.type} ${item.quantityDelta}`}>
            <View style={styles.rowHeader}>
              <MovementTypeChip type={item.type} />
              <Text
                style={[
                  styles.delta,
                  { color: item.quantityDelta > 0 ? colors.primary : colors.error },
                ]}>
                {item.quantityDelta > 0 ? '+' : ''}
                {item.quantityDelta}
              </Text>
            </View>
            <Text style={styles.reason}>{item.reason}</Text>
            {item.sourceName ? (
              <Text style={styles.source}>स्रोत: {item.sourceName}</Text>
            ) : null}
            <View style={styles.meta}>
              <Text style={styles.metaText}>शेष: {item.balanceAfter}</Text>
              <Text style={styles.metaText}>
                {new Date(item.recordedAt).toLocaleString('hi-IN')}
              </Text>
            </View>
          </View>
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() => setModalOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="आंदोलन दर्ज करें">
        <Text style={styles.fabText}>+ आंदोलन दर्ज करें</Text>
      </Pressable>

      {id ? (
        <RecordMovementModal
          productId={id}
          visible={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: {
    ...typography.headingMid,
    fontSize: 24,
    color: colors.ink,
    padding: spacing.lg,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  loader: { marginTop: spacing.lg },
  errorText: {
    color: colors.error,
    padding: spacing.md,
    textAlign: 'center',
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  empty: {
    textAlign: 'center',
    padding: spacing.xl,
    color: colors.textSecondary,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100, // FAB clearance
  },
  row: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  delta: {
    ...typography.headingMid,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  reason: {
    ...typography.body,
    fontSize: 16,
    marginTop: spacing.sm,
    color: colors.ink,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  source: {
    ...typography.body,
    fontSize: 14,
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  metaText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  fabText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
});
