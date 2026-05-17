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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import type { TryAtHomeBookingResponse } from '../../src/features/try-at-home/types';

interface CustomerSummary { id: string; name: string; phone?: string }
interface ProductSummary  { id: string; sku: string; metal: string; purity: string; status: string }
interface TryAtHomeSettings { tryAtHomeMaxPieces: number }

export default function NewTryAtHomeBookingScreen(): React.ReactElement {
  const qc = useQueryClient();

  const [customerId,   setCustomerId]   = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [notes,        setNotes]        = useState('');

  const { data: settings } = useQuery({
    queryKey: ['settings-try-at-home-limit'],
    queryFn: async () => (await api.get<TryAtHomeSettings>('/api/v1/settings/try-at-home')).data,
    retry: false,
  });

  const maxPieces = settings?.tryAtHomeMaxPieces ?? 5;

  const { data: customers } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn:  async () => {
      const q = customerSearch.trim();
      if (!q) return [] as CustomerSummary[];
      const r = await api.get<{ customers: CustomerSummary[] }>(
        `/api/v1/crm/customers?q=${encodeURIComponent(q)}&limit=10`,
      );
      return r.data.customers;
    },
    enabled: customerSearch.trim().length >= 2,
  });

  const { data: products } = useQuery({
    queryKey: ['products-in-stock'],
    queryFn:  async () => {
      const r = await api.get<ProductSummary[] | { products: ProductSummary[] }>(
        '/api/v1/inventory/products?status=IN_STOCK&pageSize=100',
      );
      return Array.isArray(r.data) ? r.data : r.data.products;
    },
  });

  const toggleProduct = (id: string): void => {
    setSelectedProducts((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= maxPieces) {
        Alert.alert('सीमा', `अधिकतम ${maxPieces} आइटम चुन सकते हैं`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const mutation = useMutation<TryAtHomeBookingResponse>({
    mutationFn: async () => {
      const r = await api.post<TryAtHomeBookingResponse>('/api/v1/try-at-home/bookings', {
        customerId,
        productIds: selectedProducts,
        notes:      notes.trim() || undefined,
      });
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['try-at-home-bookings'] });
      router.back();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert('त्रुटि', msg ?? 'बुकिंग नहीं बन सकी। पुनः प्रयास करें।');
    },
  });

  const canSubmit = !!customerId && selectedProducts.length > 0 && !mutation.isPending;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.label}>ग्राहक खोजें *</Text>
        <TextInput
          style={styles.input}
          placeholder="नाम या फ़ोन नंबर"
          placeholderTextColor="#BDBDBD"
          value={customerSearch}
          onChangeText={setCustomerSearch}
        />
        {customerId ? (
          <View style={styles.selected}>
            <Text style={styles.selectedText}>✓ ग्राहक चुना गया</Text>
            <Pressable onPress={() => { setCustomerId(''); setCustomerSearch(''); }}>
              <Text style={styles.clearText}>बदलें</Text>
            </Pressable>
          </View>
        ) : (
          customers?.map((c) => (
            <Pressable
              key={c.id}
              style={styles.suggestion}
              onPress={() => { setCustomerId(c.id); setCustomerSearch(c.name); }}
            >
              <Text style={styles.suggestionName}>{c.name}</Text>
              {c.phone && <Text style={styles.suggestionPhone}>{c.phone}</Text>}
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>
          आइटम चुनें * ({selectedProducts.length}/{maxPieces})
        </Text>
        {products?.filter((p) => p.status === 'IN_STOCK').map((p) => {
          const isSelected = selectedProducts.includes(p.id);
          return (
            <Pressable
              key={p.id}
              style={[styles.productRow, isSelected && styles.productRowSelected]}
              onPress={() => toggleProduct(p.id)}
              android_ripple={{ color: '#D4A85A33' }}
            >
              <View style={[styles.check, isSelected && styles.checkSelected]}>
                {isSelected && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productSku}>{p.sku}</Text>
                <Text style={styles.productMeta}>{p.metal} · {p.purity}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>नोट (वैकल्पिक)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="कोई विशेष जानकारी..."
          placeholderTextColor="#BDBDBD"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
      </View>

      <Pressable
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={() => mutation.mutate()}
        disabled={!canSubmit}
      >
        {mutation.isPending
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.submitText}>बुकिंग बनाएँ</Text>
        }
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#FAF6F0' },
  section:             { margin: 16, marginBottom: 0 },
  label:               { fontSize: 15, fontWeight: '600', color: '#3E2723', marginBottom: 8 },
  input:               { borderWidth: 1.5, borderColor: '#D4A85A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#3E2723', backgroundColor: '#FFF' },
  textArea:            { minHeight: 80, textAlignVertical: 'top' },
  selected:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, padding: 10, backgroundColor: '#E8F5E9', borderRadius: 8 },
  selectedText:        { color: '#2E7D32', fontWeight: '600' },
  clearText:           { color: '#D4A85A', fontWeight: '600' },
  suggestion:          { padding: 12, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#E0D5C8', marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  suggestionName:      { fontSize: 15, color: '#3E2723', fontWeight: '600' },
  suggestionPhone:     { fontSize: 13, color: '#8D6E63' },
  productRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E0D5C8', marginBottom: 8, backgroundColor: '#FFF' },
  productRowSelected:  { borderColor: '#D4A85A', backgroundColor: '#FFF8EE' },
  check:               { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#BDBDBD', alignItems: 'center', justifyContent: 'center' },
  checkSelected:       { borderColor: '#D4A85A', backgroundColor: '#D4A85A' },
  checkMark:           { color: '#FFF', fontSize: 14, fontWeight: '700' },
  productInfo:         { flex: 1 },
  productSku:          { fontSize: 15, fontWeight: '700', color: '#3E2723' },
  productMeta:         { fontSize: 13, color: '#8D6E63' },
  submitBtn:           { margin: 16, marginTop: 24, paddingVertical: 16, borderRadius: 12, backgroundColor: '#D4A85A', alignItems: 'center' },
  submitBtnDisabled:   { opacity: 0.5 },
  submitText:          { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
