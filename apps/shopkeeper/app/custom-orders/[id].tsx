import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import type {
  CustomOrderResponse,
  MilestoneResponse,
  CustomOrderStatus,
} from '../../src/features/custom-orders/types';
import { STATUS_LABELS, STATUS_COLORS } from '../../src/features/custom-orders/types';
import { AddMilestoneSheet } from '../../src/features/custom-orders/components/AddMilestoneSheet';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPaise(paise: string | null): string {
  if (!paise) return '—';
  return `₹${(Number(paise) / 100).toLocaleString('hi-IN', { maximumFractionDigits: 0 })}`;
}

function StatusChip({ status }: { status: CustomOrderStatus }): React.ReactElement {
  return (
    <View style={[styles.chip, { backgroundColor: STATUS_COLORS[status] + '22', borderColor: STATUS_COLORS[status] }]}>
      <Text style={[styles.chipText, { color: STATUS_COLORS[status] }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

function MilestoneItem({ m }: { m: MilestoneResponse }): React.ReactElement {
  return (
    <View style={styles.milestone}>
      <View style={styles.milestoneDot} />
      <View style={styles.milestoneContent}>
        <Text style={styles.milestoneTitle}>{m.title}</Text>
        {m.note && <Text style={styles.milestoneNote}>{m.note}</Text>}
        <Text style={styles.milestoneDate}>{formatDate(m.createdAt)}</Text>
      </View>
    </View>
  );
}

export default function CustomOrderDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [showMilestoneSheet, setShowMilestoneSheet] = useState(false);
  const [depositAmount, setDepositAmount]           = useState('');

  const { data: order, isLoading } = useQuery<CustomOrderResponse & { milestones: MilestoneResponse[] }>({
    queryKey:  ['custom-order', id],
    queryFn:   async () => (await api.get<CustomOrderResponse & { milestones: MilestoneResponse[] }>(`/api/v1/custom-orders/${id}`)).data,
    enabled:   !!id,
  });

  const markReadyMutation = useMutation({
    mutationFn: async () => api.patch(`/api/v1/custom-orders/${id}/ready`),
    onSuccess:  () => void qc.invalidateQueries({ queryKey: ['custom-order', id] }),
    onError:    () => Alert.alert('त्रुटि', 'स्थिति अपडेट नहीं हो सकी'),
  });

  const convertMutation = useMutation({
    mutationFn: async () =>
      (await api.post<{ invoiceId: string; orderId: string; status: string }>(`/api/v1/custom-orders/${id}/convert-to-invoice`)).data,
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['custom-order', id] });
      Alert.alert(
        'सफलता',
        `इनवॉइस बन गया!\nइनवॉइस ID: ${result.invoiceId.slice(0, 8)}...`,
        [{ text: 'ठीक है', onPress: () => router.back() }],
      );
    },
    onError: () => Alert.alert('त्रुटि', 'इनवॉइस नहीं बन सका'),
  });

  const cashDepositMutation = useMutation({
    mutationFn: async (amountPaise: string) => {
      const r = await api.post<CustomOrderResponse>(`/api/v1/custom-orders/${id}/deposit/cash`, {
        amountPaise,
      });
      return r.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['custom-order', id] });
      setDepositAmount('');
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'compliance.section_269ss') {
        Alert.alert(
          'भुगतान अस्वीकृत',
          'धारा 269SS: ₹20,000 या उससे अधिक नकद अग्रिम स्वीकार नहीं किया जा सकता।',
        );
      } else {
        Alert.alert('त्रुटि', 'अग्रिम दर्ज नहीं हो सका');
      }
    },
  });

  if (isLoading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  const remaining = order.quotedAmountPaise
    ? Number(order.quotedAmountPaise) - Number(order.depositPaidPaise)
    : null;

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.descriptionText} numberOfLines={3}>{order.description}</Text>
            <StatusChip status={order.status as CustomOrderStatus} />
          </View>
          {order.estimatedDeliveryDate && (
            <Text style={styles.deliveryDate}>डिलीवरी: {order.estimatedDeliveryDate}</Text>
          )}
          <Text style={styles.createdAt}>बनाया: {formatDate(order.createdAt)}</Text>
        </View>

        {/* Deposit status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>भुगतान विवरण</Text>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>अनुमानित राशि</Text>
            <Text style={styles.payValue}>{formatPaise(order.quotedAmountPaise)}</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>अग्रिम निर्धारित</Text>
            <Text style={styles.payValue}>{formatPaise(order.depositAmountPaise)}</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>अग्रिम प्राप्त</Text>
            <Text style={[styles.payValue, styles.paid]}>{formatPaise(order.depositPaidPaise)}</Text>
          </View>
          {remaining !== null && (
            <View style={styles.payRow}>
              <Text style={[styles.payLabel, styles.bold]}>शेष राशि</Text>
              <Text style={[styles.payValue, styles.bold]}>
                ₹{(remaining / 100).toLocaleString('hi-IN', { maximumFractionDigits: 0 })}
              </Text>
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>प्रगति ({order.milestones?.length ?? 0})</Text>
          {(order.milestones ?? []).length === 0 && (
            <Text style={styles.emptyText}>कोई प्रगति नहीं जोड़ी गई</Text>
          )}
          <View style={styles.timeline}>
            {(order.milestones ?? []).map((m) => <MilestoneItem key={m.id} m={m} />)}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          {order.status === 'DEPOSIT_PENDING' && (
            <View style={styles.cashDepositRow}>
              <Text style={styles.label}>नकद अग्रिम (₹)</Text>
              <TextInput
                value={depositAmount}
                onChangeText={(value) => setDepositAmount(value.replace(/[^0-9.]/g, ''))}
                style={styles.depositInput}
                keyboardType="decimal-pad"
                placeholder="Amount in rupees"
                placeholderTextColor="#9E7A40"
                accessibilityLabel="Cash deposit amount"
              />
              <Pressable
                style={styles.actionBtn}
                onPress={() => {
                  const paise = Math.round(parseFloat(depositAmount) * 100);
                  if (isNaN(paise) || paise <= 0) {
                    Alert.alert('राशि दर्ज करें', 'सही राशि लिखें');
                    return;
                  }
                  cashDepositMutation.mutate(String(paise));
                }}
                disabled={cashDepositMutation.isPending}
              >
                {cashDepositMutation.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.actionBtnText}>नकद जमा करें</Text>}
              </Pressable>
            </View>
          )}

          {['IN_PROGRESS', 'READY'].includes(order.status) && (
            <Pressable
              style={[styles.actionBtn, styles.milestoneBtn]}
              onPress={() => setShowMilestoneSheet(true)}
            >
              <Text style={styles.actionBtnText}>+ प्रगति जोड़ें</Text>
            </Pressable>
          )}

          {order.status === 'IN_PROGRESS' && (
            <Pressable
              style={[styles.actionBtn, styles.readyBtn]}
              onPress={() => markReadyMutation.mutate()}
              disabled={markReadyMutation.isPending}
            >
              {markReadyMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.actionBtnText}>तैयार है ✓</Text>}
            </Pressable>
          )}

          {order.status === 'READY' && order.quotedAmountPaise && (
            <Pressable
              style={[styles.actionBtn, styles.convertBtn]}
              onPress={() => {
                Alert.alert(
                  'इनवॉइस बनाएँ?',
                  `शेष राशि ₹${remaining !== null ? (remaining / 100).toLocaleString('hi-IN') : '—'} का इनवॉइस बनेगा।`,
                  [
                    { text: 'रद्द', style: 'cancel' },
                    { text: 'बनाएँ', onPress: () => convertMutation.mutate() },
                  ],
                );
              }}
              disabled={convertMutation.isPending}
            >
              {convertMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.actionBtnText}>इनवॉइस बनाएँ</Text>}
            </Pressable>
          )}
        </View>
      </ScrollView>

      <AddMilestoneSheet
        orderId={id ?? ''}
        visible={showMilestoneSheet}
        onClose={() => setShowMilestoneSheet(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen:           { flex: 1, backgroundColor: '#F5EDDD' },
  content:          { padding: 16, paddingBottom: 48, gap: 14 },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerCard:       { backgroundColor: '#FDF6EC', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E8D5A3', gap: 6 },
  headerRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  descriptionText:  { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 16, color: '#3D2000', flex: 1 },
  chip:             { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, flexShrink: 0 },
  chipText:         { fontSize: 12, fontFamily: 'NotoSansDevanagari_400Regular' },
  deliveryDate:     { fontSize: 13, color: '#7A5400' },
  createdAt:        { fontSize: 12, color: '#9E7A40' },
  section:          { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E8D5A3', gap: 8 },
  sectionTitle:     { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 15, color: '#5C3D11', marginBottom: 4 },
  payRow:           { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  payLabel:         { fontSize: 14, color: '#5C3D11' },
  payValue:         { fontSize: 14, color: '#3D2000', fontWeight: '600' },
  paid:             { color: '#2E7D32' },
  bold:             { fontFamily: 'NotoSansDevanagari_700Bold' },
  timeline:         { gap: 12 },
  milestone:        { flexDirection: 'row', gap: 10 },
  milestoneDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#B8860B', marginTop: 5, flexShrink: 0 },
  milestoneContent: { flex: 1, gap: 2 },
  milestoneTitle:   { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 14, color: '#3D2000' },
  milestoneNote:    { fontSize: 13, color: '#7A5400' },
  milestoneDate:    { fontSize: 12, color: '#9E7A40' },
  emptyText:        { fontSize: 14, color: '#9E7A40', textAlign: 'center', paddingVertical: 8 },
  actionsSection:   { gap: 10 },
  cashDepositRow:   { gap: 6 },
  label:            { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 14, color: '#5C3D11' },
  depositInput:     {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D9C9A8',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1E2440',
  },
  actionBtn:        { backgroundColor: '#B8860B', borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 52, paddingHorizontal: 16 },
  milestoneBtn:     { backgroundColor: '#1565C0' },
  readyBtn:         { backgroundColor: '#2E7D32' },
  convertBtn:       { backgroundColor: '#6A1B9A' },
  actionBtnText:    { color: '#fff', fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 15 },
});
