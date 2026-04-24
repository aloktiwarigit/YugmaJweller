import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { api } from '../../../api/client';
import { InventoryRow } from './InventoryRow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchHit {
  id: string;
  sku: string;
  metal: string;
  purity: string;
  huid: string | null;
  status: string;
  weightG: string;
  category: string;
  published: boolean;
  updatedAt: number;
}

interface SearchResultResponse {
  hits: SearchHit[];
  total: number;
  source: 'meilisearch' | 'postgres';
}

export interface InventorySearchProps {
  onResults?: (results: SearchHit[], source: 'meilisearch' | 'postgres') => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InventorySearch({ onResults }: InventorySearchProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [source, setSource] = useState<'meilisearch' | 'postgres' | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setResults([]);
      setSource(null);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearched(false);
    try {
      const res = await api.get<SearchResultResponse>('/api/v1/inventory/search', {
        params: { q: q.trim(), limit: 20, offset: 0 },
      });
      setResults(res.data.hits);
      setSource(res.data.source);
      onResults?.(res.data.hits, res.data.source);
    } catch {
      setResults([]);
      setSource(null);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [onResults]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, runSearch]);

  const renderItem = useCallback(
    ({ item }: { item: SearchHit }) => (
      <InventoryRow
        id={item.id}
        sku={item.sku}
        metal={item.metal}
        purity={item.purity}
        weightG={item.weightG}
        status={item.status}
        huid={item.huid}
        published={item.published}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: SearchHit) => item.id, []);

  const showDegradedNotice = source === 'postgres' && results.length > 0 && searched;

  return (
    <View style={styles.container}>
      {/* Search input */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="SKU, धातु, या HUID से खोजें…"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="इन्वेंटरी खोज"
          accessibilityHint="SKU, धातु, या HUID दर्ज करें"
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={styles.spinner}
            accessibilityLabel="खोज हो रही है"
          />
        )}
      </View>

      {/* Degraded mode notice */}
      {showDegradedNotice && (
        <View style={styles.degradedBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={styles.degradedText}>
            खोज धीमी है — Meilisearch उपलब्ध नहीं
          </Text>
        </View>
      )}

      {/* Results list */}
      {!loading && searched && results.length === 0 ? (
        <View style={styles.emptyState} accessibilityLiveRegion="polite">
          <Text style={styles.emptyText}>कोई उत्पाद नहीं मिला</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          accessibilityLabel="खोज परिणाम"
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    marginBottom: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  spinner: {
    marginLeft: spacing.sm,
  },
  degradedBanner: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFD54F',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs ?? 6,
    marginBottom: spacing.sm,
  },
  degradedText: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 13,
    color: '#795548',
  },
  list: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xl ?? 32,
  },
  emptyText: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 16,
    color: colors.textSecondary,
  },
});
