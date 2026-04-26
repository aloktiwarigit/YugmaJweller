import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import type { CustomerResponse, CreateCustomerDto } from '@goldsmith/shared';

function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s-]/g, '');
  if (/^\+91[6-9]\d{9}$/.test(stripped)) return stripped;
  if (/^[6-9]\d{9}$/.test(stripped)) return `+91${stripped}`;
  return stripped;
}

export default function NewCustomerScreen(): JSX.Element {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [pan, setPan] = useState('');

  const createMutation = useMutation<CustomerResponse, unknown, CreateCustomerDto>({
    mutationFn: async (dto) => {
      const res = await api.post<CustomerResponse>('/api/v1/crm/customers', dto);
      return res.data;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (customer) => router.replace(`/customers/${customer.id}` as any),
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { code?: string } } };
      if (apiErr.response?.data?.code === 'crm.phone_exists') {
        Alert.alert('ग्राहक पहले से मौजूद है', 'इस नंबर का ग्राहक पहले से है। प्रोफाइल देखें?', [
          { text: 'रद्द करें', style: 'cancel' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { text: 'प्रोफाइल देखें', onPress: () => router.push(`/customers?q=${encodeURIComponent(phone)}` as any) },
        ]);
      } else {
        Alert.alert('त्रुटि', 'ग्राहक जोड़ने में समस्या हुई। फिर से कोशिश करें।');
      }
    },
  });

  const handleSave = () => {
    const normalizedPhone = normalizePhone(phone);
    const normalizedPan = pan.trim().toUpperCase();
    if (!name.trim()) { Alert.alert('जानकारी आवश्यक', 'ग्राहक का नाम डालें।'); return; }
    if (!/^\+91[6-9]\d{9}$/.test(normalizedPhone)) { Alert.alert('मोबाइल नंबर गलत है', 'सही भारतीय मोबाइल नंबर डालें।'); return; }
    if (normalizedPan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizedPan)) { Alert.alert('PAN गलत है', 'सही PAN नंबर डालें।'); return; }
    createMutation.mutate({ phone: normalizedPhone, name: name.trim(), city: city.trim() || undefined, pincode: pincode.trim() || undefined, pan: normalizedPan || undefined });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>नया ग्राहक जोड़ें</Text>
      <Text style={styles.label}>मोबाइल नंबर *</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" maxLength={14} accessibilityLabel="मोबाइल नंबर" />
      <Text style={styles.label}>नाम *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="ग्राहक का नाम" maxLength={200} accessibilityLabel="नाम" />
      <Text style={styles.label}>शहर</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="शहर" maxLength={100} accessibilityLabel="शहर" />
      <Text style={styles.label}>पिनकोड</Text>
      <TextInput style={styles.input} value={pincode} onChangeText={setPincode} placeholder="6 अंकों का पिनकोड" keyboardType="numeric" maxLength={6} accessibilityLabel="पिनकोड" />
      <Text style={styles.label}>PAN नंबर</Text>
      <TextInput style={styles.input} value={pan} onChangeText={(v) => setPan(v.toUpperCase())} placeholder="ABCDE1234F" autoCapitalize="characters" maxLength={10} accessibilityLabel="PAN नंबर" />
      {pan.length > 0 && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan) && <Text style={styles.errorText}>PAN का प्रारूप गलत है</Text>}
      <Pressable style={[styles.saveButton, createMutation.isPending && styles.saveButtonDisabled]} onPress={handleSave} disabled={createMutation.isPending} accessibilityRole="button" accessibilityLabel="ग्राहक जोड़ें">
        <Text style={styles.saveButtonText}>{createMutation.isPending ? 'सहेज रहे हैं…' : 'ग्राहक जोड़ें'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5EDDD' }, content: { padding: 20, paddingBottom: 48 },
  screenTitle: { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 22, color: '#5C3D11', marginBottom: 24 },
  label: { fontFamily: 'NotoSansDevanagari_400Regular', fontSize: 16, color: '#5C3D11', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9A96E', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#2D1A05', minHeight: 48 },
  errorText: { color: '#C0392B', fontSize: 13, marginTop: 4 },
  saveButton: { marginTop: 32, backgroundColor: '#5C3D11', borderRadius: 10, paddingVertical: 16, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  saveButtonDisabled: { backgroundColor: '#A08060' },
  saveButtonText: { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 18, color: '#F5EDDD' },
});