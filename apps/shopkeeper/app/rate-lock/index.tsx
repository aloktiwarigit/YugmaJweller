import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { api } from '../../src/api/client';
import { CustomerSearch } from '../../src/features/crm/components/CustomerSearch';
import type { CustomerHit } from '../../src/features/crm/components/CustomerSearch';
import { CreateRateLockSheet } from '../../src/features/rate-lock/CreateRateLockSheet';

interface RateLockBooking {
  id:                        string;
  customerId:                string;
  lockedRate24kPaisePerGram: string;
  lockedAt:                  string;
  expiresAt:                 string;
  depositAmountPaise:        string;
  status:                    string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'भुगतान लंबित',
  ACTIVE:          'सक्रिय',
  USED:            'उपयोग किया',
  EXPIRED:         'समाप्त',
  CANCELLED:       'रद्द',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: '#D97706',
  ACTIVE:          '#059669',
  USED:            '#6B7280',
  EXPIRED:         '#DC2626',
  CANCELLED:       '#9CA3AF',
};

function formatRate(paisePerGram: string): string {
  return `₹${Math.round(Number(paisePerGram) / 100).toLocaleString('en-IN')}/g`;
}

export default function RateLockIndexScreen(): React.ReactElement {
  const qc = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const { data: bookings = [], isLoading, isError, refetch } = useQuery<RateLockBooking[]>({
    queryKey:  ['rate-lock-bookings-shop'],
    queryFn:   () => api.get<RateLockBooking[]>('/api/v1/rate-lock/bookings').then((r) => r.data),
    staleTime: 30_000,
  });

  const handleCustomerSearch = useCallback(
    (q: string) =>
      api.get<{ hits: CustomerHit[]; total: number; source: 'meilisearch' | 'postgres' }>(
        '/api/v1/crm/customers/search',
        { params: { q } },
      ).then((r) => r.data),
    [],
  );

  const openCreateSheet = (): void => {
    if (selectedCustomer != null) setShowCreateSheet(true);
  };

  const renderCreatePanel = (): React.ReactElement => (
    <View style={styles.createPanel}>
      <Text style={styles.createTitle}>New rate-lock booking</Text>
      {selectedCustomer == null ? (
        <CustomerSearch
          onSearch={handleCustomerSearch}
          onSelect={setSelectedCustomer}
          placeholder="Search customer by name, city, or last 4 digits"
        />
      ) : (
        <View style={styles.selectedCustomerRow}>
          <View style={styles.selectedCustomerTextWrap}>
            <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
            <Text style={styles.selectedCustomerMeta}>
              {selectedCustomer.city ?? 'Customer'} - {selectedCustomer.phoneLast4}
            </Text>
          </View>
          <Pressable
            onPress={() => setSelectedCustomer(null)}
            accessibilityRole="button"
            style={styles.changeCustomerBtn}
          >
            <Text style={styles.changeCustomerText}>Change</Text>
          </Pressable>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        style={[styles.createBtn, selectedCustomer == null && styles.createBtnDisabled]}
        onPress={openCreateSheet}
        disabled={selectedCustomer == null}
      >
        <Text style={styles.createBtnText}>Create booking</Text>
      </Pressable>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>जानकारी लोड नहीं हो सकी।</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.retryBtn}
          onPress={() => void refetch()}
        >
          <Text style={styles.retryBtnText}>पुनः प्रयास</Text>
        </Pressable>
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          {renderCreatePanel()}
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>कोई दर-लॉक बुकिंग नहीं है।</Text>
          </View>
        </ScrollView>
        {showCreateSheet && selectedCustomer != null ? (
          <CreateRateLockSheet
            customerId={selectedCustomer.id}
            onClose={() => setShowCreateSheet(false)}
            onSuccess={(result) => {
              setShowCreateSheet(false);
              void qc.invalidateQueries({ queryKey: ['rate-lock-bookings-shop'] });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              router.push(`/rate-lock/${result.bookingId}` as any);
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {renderCreatePanel()}
        {bookings.map((b) => (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onPress={() => router.push(`/rate-lock/${b.id}` as any)}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[b.status] ?? '#6B7280' }]}>
                <Text style={styles.statusChipText}>
                  {STATUS_LABELS[b.status] ?? b.status}
                </Text>
              </View>
              <Text style={styles.rateText}>{formatRate(b.lockedRate24kPaisePerGram)}</Text>
            </View>
            <Text style={styles.depositText}>
              जमा: ₹{Math.round(Number(b.depositAmountPaise) / 100).toLocaleString('en-IN')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {showCreateSheet && selectedCustomer != null ? (
        <CreateRateLockSheet
          customerId={selectedCustomer.id}
          onClose={() => setShowCreateSheet(false)}
          onSuccess={(result) => {
            setShowCreateSheet(false);
            void qc.invalidateQueries({ queryKey: ['rate-lock-bookings-shop'] });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.push(`/rate-lock/${result.bookingId}` as any);
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: colors.bg },
  content:      { padding: spacing.md },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText:    { fontFamily: typography.body.family, color: colors.error, marginBottom: spacing.sm, fontSize: 16 },
  emptyText:    { fontFamily: typography.body.family, color: colors.inkMute, fontSize: 16 },
  emptyCard:    {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  createPanel:  {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  createTitle:  {
    fontFamily: typography.headingMid.family,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  selectedCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    minHeight: 56,
  },
  selectedCustomerTextWrap: { flex: 1, marginRight: spacing.sm },
  selectedCustomerName: { fontFamily: typography.body.family, fontSize: 15, fontWeight: '700', color: colors.ink },
  selectedCustomerMeta: { fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute },
  changeCustomerBtn: { minHeight: 40, justifyContent: 'center' },
  changeCustomerText: { fontFamily: typography.body.family, fontSize: 14, fontWeight: '700', color: colors.primaryDeep },
  createBtn: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  createBtnDisabled: { opacity: 0.45 },
  createBtnText: { fontFamily: typography.body.family, fontSize: 16, fontWeight: '700', color: colors.ink },
  retryBtn:     { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md },
  retryBtnText: { fontFamily: typography.body.family, color: colors.ink, fontSize: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius:    radii.md,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
    minHeight:       72,
  },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  statusChip:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  statusChipText: { fontFamily: typography.body.family, color: colors.white, fontSize: 12 },
  rateText:       { fontFamily: typography.display.family, fontSize: 16, color: colors.ink },
  depositText:    { fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute },
});
