import React, { useState, useEffect } from 'react';
import { ScrollView, Text, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';
import { WeightField } from '../../../src/features/inventory/components/WeightField';
import { MetalSelector } from '../../../src/features/inventory/components/MetalSelector';
import { PuritySelector } from '../../../src/features/inventory/components/PuritySelector';
import { HuidInput } from '../../../src/features/inventory/components/HuidInput';
import { api } from '../../../src/api/client';

type Metal = 'GOLD' | 'SILVER' | 'PLATINUM';

interface FormState {
  sku: string;
  metal: Metal | undefined;
  purity: string;
  grossWeightG: string;
  netWeightG: string;
  stoneWeightG: string;
  huid: string;
}

export default function EditProductScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [form, setForm] = useState<FormState>({
    sku: '', metal: undefined, purity: '',
    grossWeightG: '', netWeightG: '', stoneWeightG: '', huid: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await api.get(`/api/v1/inventory/products/${id}`);
      return res.data as FormState & { metal: Metal };
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        sku: data.sku ?? '',
        metal: data.metal,
        purity: data.purity ?? '',
        grossWeightG: data.grossWeightG ?? '',
        netWeightG: data.netWeightG ?? '',
        stoneWeightG: data.stoneWeightG ?? '',
        huid: data.huid ?? '',
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (patch: Partial<FormState>) => {
      const res = await api.patch(`/api/v1/inventory/products/${id}`, patch);
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('', t('inventory.success_updated'));
      router.back();
    },
  });

  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>{t('inventory.label_metal')}</Text>
      <MetalSelector
        value={form.metal}
        onChange={(m) => setForm((p) => ({ ...p, metal: m, purity: '' }))}
      />

      <Text style={styles.sectionLabel}>{t('inventory.label_purity')}</Text>
      <PuritySelector
        metal={form.metal}
        value={form.purity}
        onChange={(p) => setForm((prev) => ({ ...prev, purity: p }))}
      />

      <WeightField
        label={t('inventory.label_gross_weight')}
        value={form.grossWeightG}
        onChangeText={(v) => setForm((p) => ({ ...p, grossWeightG: v }))}
      />
      <WeightField
        label={t('inventory.label_net_weight')}
        value={form.netWeightG}
        onChangeText={(v) => setForm((p) => ({ ...p, netWeightG: v }))}
      />

      <HuidInput
        value={form.huid}
        onChangeText={(v) => setForm((p) => ({ ...p, huid: v }))}
      />

      <Pressable
        style={[styles.saveBtn, mutation.isPending && styles.saveBtnDisabled]}
        onPress={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        accessibilityRole="button"
        accessibilityLabel={t('inventory.btn_save')}
      >
        {mutation.isPending
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.saveBtnText}>{t('inventory.btn_save')}</Text>
        }
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs, fontSize: 16 },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    minHeight: 56, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.white, fontSize: 18, fontWeight: '600' },
});
