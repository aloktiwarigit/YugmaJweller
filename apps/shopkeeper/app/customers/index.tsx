import React, { useCallback } from 'react';
import {
  View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { api } from '../../src/api/client';
import { CustomerSearch } from '../../src/features/crm/components/CustomerSearch';
import type { CustomerHit } from '../../src/features/crm/components/CustomerSearch';

interface CustomerRow {
  id:        string;
  name:      string;
  phone:     string;
  city:      string | null;
  createdAt: string;
}

interface ListResponse {
  customers: CustomerRow[];
  total:     number;
}

interface SearchHit {
  id:         string;
  name:       string;
  phoneLast4: string;
  city:       string | null;
  updatedAt:  number;
}

interface SearchResponse {
  hits:   SearchHit[];
  total:  number;
  source: 'meilisearch' | 'postgres';
}

function maskPhone(phone: string): string {
  const last4 = phone.slice(-4);
  return `+91 ●●●●●● ${last4}`;
}

export default function CustomerListScreen(): React.ReactElement {
  const { data, isLoading, error, refetch, isRefetching } = useQuery<ListResponse>({
    queryKey: ['customers', 'recent'],
    queryFn: async () => {
      const res = await api.get<ListResponse>('/api/v1/crm/customers', {
        params: { limit: 20, offset: 0 },
      });
      return res.data;
    },
    staleTime: 60_000,
  });

  const handleSearch = useCallback(async (q: string): Promise<SearchResponse> => {
    const res = await api.get<SearchResponse>('/api/v1/crm/customers/search', {
      params: { q, limit: 20 },
    });
    return res.data;
  }, []);

  const handleSelectHit = useCallback((hit: CustomerHit) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/customers/${hit.id}` as any);
  }, []);

  const handleSelectRow = useCallback((id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/customers/${id}` as any);
  }, []);

  return (
    <View style={styles.screen}>
      {/* Action header */}
      <View style={styles.actionRow}>
        <Pressable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push('/customers/new' as any)}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel="नया ग्राहक जोड़ें"
        >
          <Ionicons name="person-add-outline" size={20} color={colors.white} />
          <Text style={styles.addBtnText}>नया ग्राहक</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <CustomerSearch onSearch={handleSearch} onSelect={handleSelectHit} />
      </View>

      {/* Recent customers list */}
      <Text style={styles.sectionLabel}>हाल के ग्राहक</Text>

      {isLoading && (
        <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>ग्राहक सूची लोड नहीं हो सकी।</Text>
          <Pressable onPress={() => void refetch()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>पुनः प्रयास करें</Text>
          </Pressable>
        </View>
      )}

      {data && data.customers.length === 0 && (
        <Text style={styles.emptyText}>अभी तक कोई ग्राहक नहीं जोड़ा गया।</Text>
      )}

      {data && data.customers.length > 0 && (
        <FlatList
          data={data.customers}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`customer-row-${item.id}`}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => handleSelectRow(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${maskPhone(item.phone)}${item.city ? `, ${item.city}` : ''}`}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {maskPhone(item.phone)}{item.city ? ` · ${item.city}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkMute} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: colors.bg },
  actionRow:    {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },
  addBtn:       {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight:       48,
    borderRadius:    8,
  },
  addBtnText:   {
    fontFamily: typography.body.family,
    fontSize:   16,
    color:      colors.white,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  searchWrapper: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.sm,
  },
  sectionLabel: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
    fontFamily:        typography.body.family,
    fontSize:          13,
    color:             colors.inkMute,
    letterSpacing:     1,
    textTransform:     'uppercase',
  },
  loader:       { marginTop: spacing.xl },
  errorBox:     {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xl,
  },
  errorText:    {
    fontFamily: typography.body.family,
    fontSize:   16,
    color:      colors.error,
    marginBottom: spacing.md,
  },
  retryBtn:     {
    backgroundColor:   colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    borderRadius:      8,
    minHeight:         48,
    justifyContent:    'center',
  },
  retryBtnText: {
    fontFamily: typography.body.family,
    fontSize:   14,
    color:      colors.white,
    fontWeight: '600',
  },
  emptyText:    {
    fontFamily: typography.body.family,
    fontSize:   15,
    color:      colors.inkMute,
    textAlign:  'center',
    marginTop:  spacing.xl,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    minHeight:         64,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor:   colors.white,
  },
  rowPressed:   { opacity: 0.7 },
  rowMain:      { flex: 1, marginRight: spacing.md },
  rowName:      {
    fontFamily: typography.body.family,
    fontSize:   16,
    color:      colors.ink,
    fontWeight: '600',
  },
  rowMeta:      {
    fontFamily: typography.body.family,
    fontSize:   13,
    color:      colors.inkMute,
    marginTop:  2,
  },
});
