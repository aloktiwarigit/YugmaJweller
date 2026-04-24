import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';
import { WeightField } from '../../src/features/inventory/components/WeightField';
import { MetalSelector } from '../../src/features/inventory/components/MetalSelector';
import { PuritySelector } from '../../src/features/inventory/components/PuritySelector';
import { HuidInput } from '../../src/features/inventory/components/HuidInput';
import { api } from '../../src/api/client';

type Metal = 'GOLD' | 'SILVER' | 'PLATINUM';

interface FormState {
  sku: string;
  metal: Metal | undefined;
  purity: string;
  grossWeightG: string;
  netWeightG: string;
  stoneWeightG: string;
  stoneDetails: string;
  makingChargeOverridePct: string;
  huid: string;
}

interface FormErrors {
  sku?: string;
  grossWeightG?: string;
  netWeightG?: string;
  stoneWeightG?: string;
  huid?: string;
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const gw = parseFloat(form.grossWeightG);
  const nw = parseFloat(form.netWeightG);
  const sw = parseFloat(form.stoneWeightG || '0');

  if (!form.sku.trim()) errors.sku = t('inventory.error_sku_required');
  if (isNaN(gw)) errors.grossWeightG = t('inventory.error_weight_format');
  if (isNaN(nw)) errors.netWeightG = t('inventory.error_weight_format');
  if (isNaN(sw)) errors.stoneWeightG = t('inventory.error_weight_format');
  if (!isNaN(gw) && !isNaN(nw) && !isNaN(sw) && gw < nw + sw) {
    errors.grossWeightG = t('inventory.error_gross_lt_net');
  }
  if (form.huid && !/^[A-Z0-9]{6}$/.test(form.huid)) {
    errors.huid = t('inventory.error_huid_format');
  }
  return errors;
}

export default function NewProductScreen(): React.ReactElement {
  const [form, setForm] = useState<FormState>({
    sku: '', metal: undefined, purity: '',
    grossWeightG: '', netWeightG: '', stoneWeightG: '',
    stoneDetails: '', makingChargeOverridePct: '', huid: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const mutation = useMutation({
    mutationFn: async (data: FormState) => {
      const res = await api.post('/api/v1/inventory/products', {
        sku: data.sku,
        metal: data.metal,
        purity: data.purity,
        grossWeightG: data.grossWeightG,
        netWeightG: data.netWeightG,
        stoneWeightG: data.stoneWeightG || '0.0000',
        stoneDetails: data.stoneDetails || undefined,
        makingChargeOverridePct: data.makingChargeOverridePct || undefined,
        huid: data.huid || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('', t('inventory.success_created'));
      router.back();
    },
  });

  function handleSave(): void {
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    mutation.mutate(form);
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

      <View style={styles.fieldContainer}>
        <Text style={styles.sectionLabel}>{t('inventory.label_sku')}</Text>
        <TextInput
          style={[styles.textInput, errors.sku ? styles.inputError : null]}
          value={form.sku}
          onChangeText={(v) => setForm((p) => ({ ...p, sku: v }))}
          autoCapitalize="characters"
          placeholder="RING-001"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={t('inventory.label_sku')}
        />
        {errors.sku ? <Text style={styles.errorText} accessibilityRole="alert">{errors.sku}</Text> : null}
      </View>

      <WeightField
        label={t('inventory.label_gross_weight')}
        value={form.grossWeightG}
        onChangeText={(v) => setForm((p) => ({ ...p, grossWeightG: v }))}
        error={errors.grossWeightG}
      />
      <WeightField
        label={t('inventory.label_net_weight')}
        value={form.netWeightG}
        onChangeText={(v) => setForm((p) => ({ ...p, netWeightG: v }))}
        error={errors.netWeightG}
      />
      <WeightField
        label={t('inventory.label_stone_weight')}
        value={form.stoneWeightG}
        onChangeText={(v) => setForm((p) => ({ ...p, stoneWeightG: v }))}
        error={errors.stoneWeightG}
      />

      <HuidInput
        value={form.huid}
        onChangeText={(v) => setForm((p) => ({ ...p, huid: v }))}
        error={errors.huid}
      />

      <Pressable
        style={[styles.saveBtn, mutation.isPending && styles.saveBtnDisabled]}
        onPress={handleSave}
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
  fieldContainer: { marginBottom: spacing.md },
  textInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: spacing.sm, minHeight: 48, fontSize: 16, color: colors.textPrimary,
  },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 13, marginTop: spacing.xs },
});
