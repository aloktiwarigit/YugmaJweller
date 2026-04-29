import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import type { CustomOrderResponse } from '../../src/features/custom-orders/types';

export default function NewCustomOrderScreen(): React.ReactElement {
  const qc = useQueryClient();
  const [description, setDescription]     = useState('');
  const [designUrl, setDesignUrl]         = useState('');
  const [quotedAmount, setQuotedAmount]   = useState('');
  const [deliveryDate, setDeliveryDate]   = useState('');

  const mutation = useMutation<CustomOrderResponse>({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        description: description.trim(),
      };
      if (designUrl.trim()) body['designReferenceUrl'] = designUrl.trim();
      if (quotedAmount.trim()) {
        const paise = Math.round(parseFloat(quotedAmount) * 100);
        if (!isNaN(paise) && paise > 0) body['quotedAmountPaise'] = String(paise);
      }
      if (deliveryDate.trim()) body['estimatedDeliveryDate'] = deliveryDate.trim();

      const r = await api.post<CustomOrderResponse>('/api/v1/custom-orders', body);
      return r.data;
    },
    onSuccess: (order) => {
      void qc.invalidateQueries({ queryKey: ['custom-orders'] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace(`/custom-orders/${order.id}` as any);
    },
    onError: () => {
      Alert.alert('त्रुटि', 'ऑर्डर नहीं बन सका। दोबारा कोशिश करें।');
    },
  });

  const canSubmit = description.trim().length > 0 && !mutation.isPending;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>नया कस्टम ऑर्डर</Text>

      <Text style={styles.label}>विवरण *</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="आभूषण की जानकारी लिखें..."
        multiline
        numberOfLines={4}
        maxLength={2000}
        autoFocus
      />

      <Text style={styles.label}>डिज़ाइन रेफरेंस URL</Text>
      <TextInput
        style={styles.input}
        value={designUrl}
        onChangeText={setDesignUrl}
        placeholder="https://..."
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>अनुमानित राशि (₹)</Text>
      <TextInput
        style={styles.input}
        value={quotedAmount}
        onChangeText={setQuotedAmount}
        placeholder="0"
        keyboardType="numeric"
      />

      <Text style={styles.label}>अनुमानित डिलीवरी तिथि (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={deliveryDate}
        onChangeText={setDeliveryDate}
        placeholder="2026-06-01"
        maxLength={10}
      />

      <Pressable
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={() => { if (canSubmit) mutation.mutate(); }}
        disabled={!canSubmit}
      >
        {mutation.isPending
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitBtnText}>ऑर्डर बनाएँ</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:            { flex: 1, backgroundColor: '#F5EDDD' },
  content:           { padding: 20, paddingBottom: 48, gap: 4 },
  heading:           { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 22, color: '#5C3D11', marginBottom: 16 },
  label:             { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 14, color: '#5C3D11', marginTop: 14, marginBottom: 6 },
  input:             { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4A85A', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#3D2000', minHeight: 52 },
  multiline:         { minHeight: 110, textAlignVertical: 'top' },
  submitBtn:         { backgroundColor: '#B8860B', borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 56, marginTop: 24 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:     { color: '#fff', fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 17 },
});
