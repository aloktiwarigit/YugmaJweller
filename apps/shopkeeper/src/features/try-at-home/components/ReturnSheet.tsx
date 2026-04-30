import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import type { TryAtHomeBookingResponse } from '../types';

interface ReturnItem {
  productId: string;
  kept: boolean;
}

interface Props {
  booking:  TryAtHomeBookingResponse;
  visible:  boolean;
  onClose:  () => void;
}

export function ReturnSheet({ booking, visible, onClose }: Props): React.ReactElement {
  const qc = useQueryClient();
  const [items, setItems] = useState<ReturnItem[]>(
    booking.productIds.map((id) => ({ productId: id, kept: false })),
  );

  const toggleItem = (productId: string): void => {
    setItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, kept: !it.kept } : it)),
    );
  };

  const keptIds     = items.filter((it) => it.kept).map((it) => it.productId);
  const returnedIds = items.filter((it) => !it.kept).map((it) => it.productId);

  const mutation = useMutation<TryAtHomeBookingResponse & { invoiceId?: string }>({
    mutationFn: async () => {
      const r = await api.post<TryAtHomeBookingResponse & { invoiceId?: string }>(
        `/api/v1/try-at-home/bookings/${booking.id}/record-return`,
        {
          returnedProductIds: returnedIds,
          keptProductIds:     keptIds,
        },
      );
      return r.data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['try-at-home-bookings'] });
      void qc.invalidateQueries({ queryKey: ['try-at-home-booking', booking.id] });
      onClose();
      if (data.invoiceId) {
        Alert.alert('वापसी दर्ज', `बिल बना: ${data.invoiceId.slice(0, 8)}…`);
      }
    },
    onError: () => {
      Alert.alert('त्रुटि', 'वापसी दर्ज नहीं हो सकी। पुनः प्रयास करें।');
    },
  });

  const handleSubmit = (): void => {
    if (items.length === 0) return;
    mutation.mutate();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>वापसी दर्ज करें</Text>
          <Text style={styles.subtitle}>
            कौन से आइटम रखे? चुनें ({keptIds.length} रखे, {returnedIds.length} वापस)
          </Text>
          <ScrollView style={styles.list}>
            {items.map((it, idx) => (
              <Pressable
                key={it.productId}
                style={[styles.row, it.kept && styles.rowKept]}
                onPress={() => toggleItem(it.productId)}
                android_ripple={{ color: '#D4A85A33' }}
              >
                <View style={[styles.check, it.kept && styles.checkKept]}>
                  {it.kept && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={styles.productLabel}>उत्पाद {idx + 1}</Text>
                <Text style={styles.productId}>{it.productId.slice(0, 8)}…</Text>
                <Text style={[styles.badge, it.kept ? styles.badgeKept : styles.badgeReturn]}>
                  {it.kept ? 'रखा' : 'वापस'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={styles.btnCancel} onPress={onClose} disabled={mutation.isPending}>
              <Text style={styles.btnCancelText}>रद्द करें</Text>
            </Pressable>
            <Pressable
              style={[styles.btnSubmit, mutation.isPending && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnSubmitText}>दर्ज करें</Text>
              }
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:        { backgroundColor: '#FFF8F0', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  title:        { fontSize: 20, fontWeight: '700', color: '#3E2723', marginBottom: 4 },
  subtitle:     { fontSize: 14, color: '#6D4C41', marginBottom: 16 },
  list:         { maxHeight: 300 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E0D5C8', marginBottom: 8, backgroundColor: '#FFF' },
  rowKept:      { borderColor: '#2E7D32', backgroundColor: '#F1F8F1' },
  check:        { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#BDB9B4', alignItems: 'center', justifyContent: 'center' },
  checkKept:    { borderColor: '#2E7D32', backgroundColor: '#2E7D32' },
  checkMark:    { color: '#FFF', fontSize: 14, fontWeight: '700' },
  productLabel: { flex: 1, fontSize: 15, color: '#3E2723', fontWeight: '600' },
  productId:    { fontSize: 12, color: '#9E9E9E' },
  badge:        { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeKept:    { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  badgeReturn:  { backgroundColor: '#FFF3E0', color: '#E65100' },
  actions:      { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnCancel:    { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#D4A85A', alignItems: 'center' },
  btnCancelText:{ fontSize: 16, color: '#D4A85A', fontWeight: '600' },
  btnSubmit:    { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#D4A85A', alignItems: 'center' },
  btnSubmitText:{ fontSize: 16, color: '#FFF', fontWeight: '700' },
  btnDisabled:  { opacity: 0.6 },
});
