import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { api } from '../../../api/client';
import type { MovementType, StockMovementResponse } from '@goldsmith/shared';

const TYPE_OPTIONS: { value: MovementType; hi: string; sign: '+' | '-' }[] = [
  { value: 'PURCHASE',       hi: 'खरीद',     sign: '+' },
  { value: 'SALE',           hi: 'बिक्री',   sign: '-' },
  { value: 'ADJUSTMENT_IN',  hi: 'जोड़',     sign: '+' },
  { value: 'ADJUSTMENT_OUT', hi: 'घटाव',     sign: '-' },
  { value: 'TRANSFER_IN',    hi: 'प्राप्त',  sign: '+' },
  { value: 'TRANSFER_OUT',   hi: 'भेजा',     sign: '-' },
];

interface Props {
  productId: string;
  visible: boolean;
  onClose: () => void;
  onRecorded?: (m: StockMovementResponse) => void;
}

export function RecordMovementModal({
  productId,
  visible,
  onClose,
  onRecorded,
}: Props): React.ReactElement {
  const qc = useQueryClient();
  const [type, setType] = useState<MovementType>('PURCHASE');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sign = TYPE_OPTIONS.find((t) => t.value === type)?.sign ?? '+';

  const mutation = useMutation({
    mutationFn: async (): Promise<StockMovementResponse> => {
      const n = parseInt(qty, 10);
      if (isNaN(n) || n <= 0) throw new Error('मात्रा वैध नहीं है');
      if (reason.trim().length < 3) throw new Error('कारण लिखें (कम से कम 3 अक्षर)');
      const delta = sign === '+' ? n : -n;
      const res = await api.post<StockMovementResponse>(
        `/api/v1/inventory/products/${productId}/movements`,
        {
          type,
          quantityDelta: delta,
          reason: reason.trim(),
          sourceName: sourceName.trim() || undefined,
        },
      );
      return res.data;
    },
    onSuccess: (m) => {
      void qc.invalidateQueries({ queryKey: ['stockMovements', productId] });
      void qc.invalidateQueries({ queryKey: ['product', productId] });
      onRecorded?.(m);
      setQty('1');
      setReason('');
      setSourceName('');
      setError(null);
      onClose();
    },
    onError: (err: unknown) => {
      const data = (err as {
        response?: { data?: { code?: string; message?: string } };
      }).response?.data;
      if (data?.code === 'inventory.insufficient_stock') {
        setError(data.message ?? 'पर्याप्त स्टॉक नहीं है');
      } else if (data?.code === 'inventory.invalid_status_transition') {
        setError('इस स्थिति से बिक्री संभव नहीं');
      } else {
        setError(
          data?.message ??
            (err instanceof Error ? err.message : 'त्रुटि — फिर से प्रयास करें'),
        );
      }
    },
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>आंदोलन दर्ज करें</Text>

        <Text style={styles.label}>प्रकार</Text>
        <View style={styles.typeGrid}>
          {TYPE_OPTIONS.map((t) => {
            const active = type === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setType(t.value)}
                style={[styles.typeChip, active && styles.typeChipActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.hi}>
                <Text style={[styles.typeText, active && styles.typeTextActive]}>
                  {t.hi}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>मात्रा ({sign})</Text>
        <TextInput
          value={qty}
          onChangeText={setQty}
          keyboardType="number-pad"
          style={styles.input}
          accessibilityLabel="मात्रा"
        />

        <Text style={styles.label}>कारण</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          multiline
          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          accessibilityLabel="कारण"
          placeholder="जैसे: बिक्री, क्षति, स्टोर ट्रांसफर"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={styles.label}>स्रोत/लक्ष्य (वैकल्पिक)</Text>
        <TextInput
          value={sourceName}
          onChangeText={setSourceName}
          style={styles.input}
          accessibilityLabel="स्रोत"
          placeholder="कारीगर का नाम / दुकान"
          placeholderTextColor={colors.textSecondary}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.submit, mutation.isPending && styles.submitDisabled]}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="दर्ज करें">
          <Text style={styles.submitText}>
            {mutation.isPending ? 'सहेज रहे हैं…' : 'दर्ज करें'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.cancel}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="रद्द">
          <Text style={styles.cancelText}>रद्द</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.bg,
    flexGrow: 1,
  },
  title: {
    ...typography.headingMid,
    fontSize: 22,
    color: colors.ink,
    marginBottom: spacing.lg,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  label: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  typeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeText: {
    ...typography.body,
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  typeTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.background,
    minHeight: 48,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  error: {
    color: colors.error,
    marginTop: spacing.md,
    fontSize: 16,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  submit: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  cancel: {
    marginTop: spacing.sm,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
});
