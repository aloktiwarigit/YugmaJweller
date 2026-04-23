import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { SettingsGroupCard } from '@goldsmith/ui-mobile';
import { t } from '@goldsmith/i18n';
import { MakingChargeRow } from '../../src/features/settings/components/MakingChargeRow';
import { api } from '../../src/api/client';
import type { MakingChargeConfig } from '@goldsmith/shared';

const DEFAULTS: MakingChargeConfig[] = [
  { category: 'RINGS',     type: 'percent', value: '12.00' },
  { category: 'CHAINS',    type: 'percent', value: '10.00' },
  { category: 'BANGLES',   type: 'percent', value: '8.00'  },
  { category: 'BRIDAL',    type: 'percent', value: '15.00' },
  { category: 'SILVER',    type: 'percent', value: '5.00'  },
  { category: 'WHOLESALE', type: 'percent', value: '7.00'  },
];

interface MakingChargesResponse {
  configs: MakingChargeConfig[];
}

export default function MakingChargesScreen(): React.ReactElement {
  const [configs, setConfigs] = useState<MakingChargeConfig[]>(DEFAULTS);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [savedCategory, setSavedCategory] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<MakingChargesResponse>({
    queryKey: ['settings', 'making-charges'],
    queryFn: async () => {
      const res = await api.get('/api/v1/settings/making-charges');
      return res.data as MakingChargesResponse;
    },
  });

  useEffect(() => {
    if (data?.configs && data.configs.length > 0) {
      setConfigs(data.configs);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (updatedConfigs: MakingChargeConfig[]) => {
      const res = await api.patch('/api/v1/settings/making-charges', updatedConfigs);
      return res.data;
    },
  });

  function handleChange(category: string): (updated: MakingChargeConfig) => void {
    return (updated: MakingChargeConfig): void => {
      setConfigs((prev) => prev.map((c) => (c.category === category ? updated : c)));
    };
  }

  function handleSave(category: string): () => void {
    return (): void => {
      const singleConfig = configs.filter((c) => c.category === category);
      setSavingCategory(category);
      mutation.mutate(singleConfig, {
        onSuccess: () => {
          setSavingCategory(null);
          setSavedCategory(category);
          setTimeout(() => setSavedCategory((c) => (c === category ? null : c)), 2000);
        },
        onError: () => {
          setSavingCategory(null);
        },
      });
    };
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>मेकिंग चार्जेस लोड नहीं हो सके।</Text>
        <Text style={styles.retryHint}>वापस जाएं और दोबारा कोशिश करें।</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {configs.map((config) => (
        <SettingsGroupCard
          key={config.category}
          title={t(`settings.making_charges.categories.${config.category}`)}
        >
          <MakingChargeRow config={config} onChange={handleChange(config.category)} />
          <View style={styles.rowFooter}>
            {savedCategory === config.category && (
              <Text style={styles.successText}>बदलाव सहेज लिया ✓</Text>
            )}
            <Pressable
              testID={`save-${config.category}`}
              onPress={savingCategory !== null ? undefined : handleSave(config.category)}
              disabled={savingCategory !== null}
              style={[styles.saveBtn, savingCategory !== null && styles.saveBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={`${t(`settings.making_charges.categories.${config.category}`)} बदलाव सहेजें`}
            >
              <Text style={styles.saveBtnText}>
                {savingCategory === config.category ? 'सहेज रहे हैं…' : 'सहेजें'}
              </Text>
            </Pressable>
          </View>
        </SettingsGroupCard>
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
  contentContainer: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  successText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: '#2E7D32',
    flex: 1,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryHint: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.inkMute,
    textAlign: 'center',
  },
});
