import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';

interface CustomerBalance {
  customerId:       string;
  outstandingPaise: string; // serialized bigint → string over JSON
  advancePaise:     string;
  lastUpdatedAt:    string;
}

interface Props {
  customerId: string;
}

function paiseToRupees(paise: string): string {
  const n = parseInt(paise, 10);
  if (isNaN(n) || n === 0) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n / 100);
}

export function BalanceCard({ customerId }: Props) {
  const { data, isLoading } = useQuery<CustomerBalance>({
    queryKey: ['customer-balance', customerId],
    queryFn:  async () => (await api.get<CustomerBalance>(`/api/v1/crm/customers/${customerId}/balance`)).data,
    staleTime: 30_000, // matches 30 s polling contract from CLAUDE.md
  });

  if (isLoading) {
    return (
      <View style={[styles.card, styles.loading]}>
        <ActivityIndicator size="small" color="#B8860B" />
      </View>
    );
  }

  const outstanding = parseInt(data?.outstandingPaise ?? '0', 10);
  const advance     = parseInt(data?.advancePaise ?? '0', 10);

  if (outstanding === 0 && advance === 0) {
    return (
      <View style={[styles.card, styles.settled]}>
        <Text style={styles.settledText}>सब चुकता ✓</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {outstanding > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>बकाया</Text>
          <Text style={[styles.amount, styles.amountOutstanding]}>
            {paiseToRupees(data!.outstandingPaise)}
          </Text>
        </View>
      )}
      {advance > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>अग्रिम</Text>
          <Text style={[styles.amount, styles.amountAdvance]}>
            {paiseToRupees(data!.advancePaise)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFDF7',
    borderRadius:    12,
    paddingHorizontal: 16,
    paddingVertical:   12,
    marginBottom:    12,
    shadowColor:     '#C8A951',
    shadowOpacity:   0.1,
    shadowRadius:    6,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       3,
    minHeight:       48,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  settled: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FFF4',
  },
  settledText: {
    fontSize:   16,
    fontWeight: '600',
    color:      '#22863A',
    fontFamily: 'NotoSansDevanagari',
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingVertical: 4,
  },
  label: {
    fontSize:   15,
    color:      '#555',
    fontFamily: 'NotoSansDevanagari',
  },
  amount: {
    fontSize:   17,
    fontWeight: '700',
  },
  amountOutstanding: {
    color: '#D97706', // amber-600
  },
  amountAdvance: {
    color: '#16A34A', // green-600
  },
});
