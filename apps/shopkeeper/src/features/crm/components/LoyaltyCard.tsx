import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import type { LoyaltyState, LoyaltyTransaction } from '@goldsmith/shared';
import { useAuthStore } from '../../../stores/authStore';
import { LoyaltyAdjustModal } from './LoyaltyAdjustModal';

const TX_TYPE_LABELS: Record<string, string> = {
  ACCRUAL:        '+ अर्जित',
  REDEMPTION:     '- भुनाया',
  ADJUSTMENT_IN:  '+ समायोजन',
  ADJUSTMENT_OUT: '- समायोजन',
  REVERSAL:       '↩ रद्द',
};

const TIER_LABELS: Record<string, string> = {
  Silver:  'सिल्वर',
  Gold:    'गोल्ड',
  Diamond: 'डायमंड',
};

function localTier(tier: string | null): string | null {
  if (!tier) return null;
  return TIER_LABELS[tier] ?? tier;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hi-IN', { day: '2-digit', month: 'short' });
}

interface Props {
  customerId: string;
}

export function LoyaltyCard({ customerId }: Props): React.ReactElement {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'shop_admin';
  const [adjustOpen, setAdjustOpen] = useState(false);

  const { data: state, isLoading: stateLoading } = useQuery<LoyaltyState>({
    queryKey: ['loyalty-state', customerId],
    queryFn: async () =>
      (await api.get<LoyaltyState>(`/api/v1/loyalty/customers/${customerId}`)).data,
    enabled: !!customerId,
  });

  const { data: txns = [], isLoading: txLoading } = useQuery<LoyaltyTransaction[]>({
    queryKey: ['loyalty-txns', customerId],
    queryFn: async () =>
      (await api.get<LoyaltyTransaction[]>(
        `/api/v1/loyalty/customers/${customerId}/transactions?limit=5`,
      )).data,
    enabled: !!customerId,
  });

  const isLoading = stateLoading || txLoading;

  function onAdjustSuccess(): void {
    setAdjustOpen(false);
    void qc.invalidateQueries({ queryKey: ['loyalty-state', customerId] });
    void qc.invalidateQueries({ queryKey: ['loyalty-txns', customerId] });
  }

  if (isLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="small" color="#B8860B" />
      </View>
    );
  }

  const tierLabel = localTier(state?.currentTier ?? null);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>लॉयल्टी अंक</Text>
        {isAdmin && (
          <TouchableOpacity
            style={styles.adjustBtn}
            onPress={() => setAdjustOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="अंक समायोजित करें"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.adjustBtnText}>अंक समायोजित करें</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.balanceRow}>
        <View style={styles.balanceBlock}>
          <Text style={styles.balanceValue}>{state?.pointsBalance ?? 0}</Text>
          <Text style={styles.balanceLabel}>उपलब्ध अंक</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.balanceBlock}>
          <Text style={styles.balanceValue}>{state?.lifetimePoints ?? 0}</Text>
          <Text style={styles.balanceLabel}>आजीवन अंक</Text>
        </View>
        {tierLabel && (
          <>
            <View style={styles.divider} />
            <View style={styles.balanceBlock}>
              <Text style={[styles.balanceValue, styles.tierValue]}>{tierLabel}</Text>
              <Text style={styles.balanceLabel}>श्रेणी</Text>
            </View>
          </>
        )}
      </View>

      {txns.length > 0 && (
        <View style={styles.txSection}>
          <Text style={styles.txTitle}>हाल की गतिविधि</Text>
          {txns.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.txLeft}>
                <Text style={styles.txType}>
                  {TX_TYPE_LABELS[tx.type] ?? tx.type}
                </Text>
                <Text style={styles.txReason} numberOfLines={1}>{tx.reason}</Text>
              </View>
              <View style={styles.txRight}>
                <Text
                  style={[
                    styles.txDelta,
                    tx.pointsDelta > 0 ? styles.txPositive : styles.txNegative,
                  ]}
                >
                  {tx.pointsDelta > 0 ? `+${tx.pointsDelta}` : `${tx.pointsDelta}`}
                </Text>
                <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {txns.length === 0 && !isLoading && (
        <Text style={styles.emptyTx}>अभी तक कोई लेनदेन नहीं</Text>
      )}

      {isAdmin && adjustOpen && (
        <LoyaltyAdjustModal
          customerId={customerId}
          currentBalance={state?.pointsBalance ?? 0}
          onSuccess={onAdjustSuccess}
          onClose={() => setAdjustOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingBox: { alignItems: 'center', paddingVertical: 24 },
  card: {
    backgroundColor: '#FFFDF7',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#C8A951',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: 'NotoSansDevanagari_700Bold',
    fontSize: 16,
    color: '#5C3D11',
  },
  adjustBtn: {
    backgroundColor: '#F5EDDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  adjustBtnText: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 13,
    color: '#7A5400',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8EC',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  balanceBlock: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 32, backgroundColor: '#E8D5A0', marginHorizontal: 4 },
  balanceValue: {
    fontFamily: 'NotoSansDevanagari_700Bold',
    fontSize: 22,
    color: '#3D2B00',
  },
  tierValue: { fontSize: 16 },
  balanceLabel: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  txSection: { borderTopWidth: 1, borderTopColor: '#F0E5C8', paddingTop: 12 },
  txTitle: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0E5C8',
  },
  txLeft: { flex: 1, gap: 2 },
  txRight: { alignItems: 'flex-end', gap: 2 },
  txType: { fontFamily: 'NotoSansDevanagari', fontSize: 13, color: '#5C3D11' },
  txReason: { fontFamily: 'NotoSansDevanagari', fontSize: 12, color: '#888' },
  txDelta: { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 15 },
  txPositive: { color: '#2E7D32' },
  txNegative: { color: '#C62828' },
  txDate: { fontSize: 11, color: '#AAA' },
  emptyTx: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 14,
    color: '#AAA',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
