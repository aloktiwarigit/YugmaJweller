import React, { useState, useEffect } from 'react';
import { ScrollView, Text, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';
import { WeightField } from '../../../src/features/inventory/components/WeightField';
import { MetalSelector } from '../../../src/features/inventory/components/MetalSelector';
import { PuritySelector } from '../../../src/features/inventory/components/PuritySelector';
import { HuidInput } from '../../../src/features/inventory/components/HuidInput';
import { StatusChipGroup } from '../../../src/features/inventory/components/StatusChipGroup';
import type { ProductStatus } from '../../../src/features/inventory/components/StatusChipGroup';
import { PublishToggle } from '../../../src/features/inventory/components/PublishToggle';
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
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({
    sku: '', metal: undefined, purity: '',
    grossWeightG: '', netWeightG: '', stoneWeightG: '', huid: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await api.get(`/api/v1/inventory/products/${id}`);
      return res.data as FormState & { metal: Metal; status: ProductStatus; publishedAt: string | null };
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

  const statusMutation = useMutation({
    mutationFn: async (newStatus: ProductStatus) => {
      const res = await api.patch(`/api/v1/inventory/products/${id}/status`, { status: newStatus });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['product', id] });
      Alert.alert('', 'स्थिति अपडेट हो गई');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'स्थिति बदलना संभव नहीं';
      Alert.alert('', msg);
    },
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<FormState>) => {
      // Strip empty optional strings so we don't send '' for fields like huid
      // that have strict format validation — undefined means "don't change it".
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== '' && v !== undefined) cleaned[k] = v;
      }
      const res = await api.patch(`/api/v1/inventory/products/${id}`, cleaned);
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

      {data?.status != null && (
        <>
          <Text style={styles.sectionLabel}>स्थिति बदलें</Text>
          <StatusChipGroup
            currentStatus={data.status}
            onSelect={(newStatus) => statusMutation.mutate(newStatus)}
            disabled={statusMutation.isPending}
          />
        </>
      )}

      {id != null && (
        <>
          <Text style={styles.sectionLabel}>कैटलॉग में प्रकाशन</Text>
          <PublishToggle
            productId={id}
            publishedAt={data?.publishedAt ?? null}
          />
        </>
      )}

      <Pressable
        style={styles.linkRow}
        onPress={() => router.push(`/inventory/${id}/movements`)}
        accessibilityRole="link"
        accessibilityLabel="आंदोलन इतिहास">
        <Text style={styles.linkText}>आंदोलन इतिहास →</Text>
      </Pressable>

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
  linkRow: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minHeight: 48,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
});
