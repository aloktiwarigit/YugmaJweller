import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  ActivityIndicator, StyleSheet,
} from 'react-native';

export interface CustomerHit {
  id:         string;
  name:       string;
  phoneLast4: string;
  city:       string | null;
  updatedAt:  number;
}

interface SearchResult {
  hits:   CustomerHit[];
  total:  number;
  source: 'meilisearch' | 'postgres';
}

interface Props {
  onSearch:  (q: string) => Promise<SearchResult>;
  onSelect?: (hit: CustomerHit) => void;
  placeholder?: string;
}

function maskPhone(phoneLast4: string): string {
  return `+91 ●●●●●● ${phoneLast4}`;
}

export function CustomerSearch({ onSearch, onSelect, placeholder }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [source, setSource] = useState<'meilisearch' | 'postgres' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (text: string) => {
      setQuery(text);
      setError(null);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (text.trim().length === 0) {
        setHits([]);
        setSource(null);
        setLoading(false);
        return;
      }

      debounceRef.current = setTimeout(() => {
        setLoading(true);
        onSearch(text.trim())
          .then((result) => {
            setHits(result.hits);
            setSource(result.source);
          })
          .catch(() => {
            setError('खोज में समस्या हुई। पुनः प्रयास करें।');
            setHits([]);
          })
          .finally(() => setLoading(false));
      }, 300);
    },
    [onSearch],
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          testID="customer-search-input"
          style={styles.input}
          placeholder={placeholder ?? 'ग्राहक का नाम, शहर या अंतिम 4 अंक'}
          placeholderTextColor="#999"
          value={query}
          onChangeText={handleChange}
          accessibilityLabel="ग्राहक खोजें"
          returnKeyType="search"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator style={styles.spinner} color="#B8860B" size="small" />}
      </View>

      {source === 'postgres' && (
        <View
          testID="degraded-notice"
          style={styles.degradedNotice}
          accessibilityRole="none"
          accessibilityLabel="खोज सीमित मोड में है"
        >
          <Text style={styles.degradedText}>सीमित खोज — पूर्ण खोज अनुपलब्ध</Text>
        </View>
      )}

      {error && (
        <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
      )}

      {hits.length > 0 && (
        <FlatList
          testID="customer-search-results"
          data={hits}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item }) => (
            <CustomerResultRow
              hit={item}
              onPress={onSelect ? () => onSelect(item) : undefined}
            />
          )}
        />
      )}

      {!loading && query.length > 0 && hits.length === 0 && !error && (
        <Text style={styles.emptyText}>कोई ग्राहक नहीं मिला</Text>
      )}
    </View>
  );
}

function CustomerResultRow({
  hit, onPress,
}: { hit: CustomerHit; onPress?: () => void }): React.ReactElement {
  return (
    <Pressable
      testID={`customer-result-${hit.id}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${hit.name}, ${maskPhone(hit.phoneLast4)}${hit.city ? `, ${hit.city}` : ''}`}
    >
      <Text style={styles.rowName} numberOfLines={1}>{hit.name}</Text>
      <View style={styles.rowMeta}>
        <Text style={styles.rowPhone}>{maskPhone(hit.phoneLast4)}</Text>
        {hit.city ? <Text style={styles.rowCity}>{hit.city}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#D4A017', borderRadius: 8,
    backgroundColor: '#fff', minHeight: 48, paddingHorizontal: 12,
  },
  input: {
    flex: 1, fontSize: 16, color: '#3D2B00',
    paddingVertical: 8,
  },
  spinner: { marginLeft: 8 },
  degradedNotice: {
    backgroundColor: '#FFF3CD', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
  },
  degradedText: { fontSize: 12, color: '#856404' },
  errorText: { fontSize: 14, color: '#B1402B' },
  list: { maxHeight: 300, borderRadius: 8, borderWidth: 1, borderColor: '#E8DCC8', backgroundColor: '#fff' },
  row: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F0E8D8',
    minHeight: 56, justifyContent: 'center',
  },
  rowPressed: { backgroundColor: '#FFF8E1' },
  rowName: { fontSize: 15, fontWeight: '600', color: '#3D2B00' },
  rowMeta: { flexDirection: 'row', gap: 8, marginTop: 2 },
  rowPhone: { fontSize: 13, color: '#666' },
  rowCity: { fontSize: 13, color: '#888' },
  emptyText: { fontSize: 14, color: '#888', fontStyle: 'italic', paddingHorizontal: 4 },
});
