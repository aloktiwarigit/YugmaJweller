import React, { useState } from 'react';
import {
  View, Text, Pressable, FlatList, Modal, StyleSheet, ActivityIndicator, TextInput,
} from 'react-native';
import type { FamilyMemberResponse } from '@goldsmith/shared';

const RELATIONSHIP_LABELS: Record<string, string> = {
  SPOUSE: 'पति/पत्नी',
  PARENT: 'माता/पिता',
  CHILD:  'पुत्र/पुत्री',
  SIBLING:'भाई/बहन',
  IN_LAW: 'ससुराल',
  OTHER:  'अन्य',
};

const RELATIONSHIPS = ['SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'IN_LAW', 'OTHER'] as const;

interface FamilySearchResult {
  id: string;
  name: string;
  phone: string;
}

interface Props {
  customerId: string;
  links: FamilyMemberResponse[];
  loading?: boolean;
  onLinkAdd: (relatedCustomerId: string, relationship: string) => Promise<void>;
  onLinkRemove: (linkId: string) => Promise<void>;
  onSearchCustomers: (query: string) => Promise<FamilySearchResult[]>;
}

export function FamilyLinker({
  links, loading, onLinkAdd, onLinkRemove, onSearchCustomers,
}: Props): React.ReactElement {
  const [showModal, setShowModal] = useState(false);
  const [searchResults, setSearchResults] = useState<FamilySearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<FamilySearchResult | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(q: string): Promise<void> {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const results = await onSearchCustomers(q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
  }

  async function handleAdd(): Promise<void> {
    if (!selectedCustomer || !selectedRelationship) return;
    setSaving(true);
    setError(null);
    try {
      await onLinkAdd(selectedCustomer.id, selectedRelationship);
      setShowModal(false);
      setSelectedCustomer(null);
      setSelectedRelationship('');
      setSearchQuery('');
      setSearchResults([]);
    } catch {
      setError('जोड़ने में समस्या हुई। पुनः प्रयास करें।');
    } finally {
      setSaving(false);
    }
  }

  function resetModal(): void {
    setShowModal(false);
    setSelectedCustomer(null);
    setSelectedRelationship('');
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>परिवार के सदस्य</Text>

      {loading ? (
        <ActivityIndicator color="#B8860B" />
      ) : (
        <>
          {links.length === 0 ? (
            <Text style={styles.emptyText}>कोई परिवारिक सदस्य नहीं जोड़ा गया</Text>
          ) : (
            <FlatList
              data={links}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <FamilyChip
                  link={item}
                  onRemove={() => void onLinkRemove(item.id)}
                />
              )}
            />
          )}

          <Pressable
            testID="family-add-btn"
            style={styles.addBtn}
            onPress={() => setShowModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Family Member जोड़ें"
          >
            <Text style={styles.addBtnText}>+ Family Member जोड़ें</Text>
          </Pressable>
        </>
      )}

      <Modal visible={showModal} animationType="slide" onRequestClose={resetModal}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>परिवार का सदस्य जोड़ें</Text>

          <CustomerSearchInput
            value={searchQuery}
            onSearch={handleSearch}
            results={searchResults}
            selected={selectedCustomer}
            onSelect={setSelectedCustomer}
          />

          {selectedCustomer && (
            <View style={styles.relPicker}>
              <Text style={styles.label}>रिश्ता चुनें</Text>
              <View style={styles.relGrid}>
                {RELATIONSHIPS.map((rel) => (
                  <Pressable
                    key={rel}
                    testID={`rel-${rel}`}
                    style={[styles.relChip, selectedRelationship === rel && styles.relChipSelected]}
                    onPress={() => setSelectedRelationship(rel)}
                    accessibilityRole="button"
                    accessibilityLabel={RELATIONSHIP_LABELS[rel]}
                  >
                    <Text style={[styles.relChipText, selectedRelationship === rel && styles.relChipTextSelected]}>
                      {RELATIONSHIP_LABELS[rel]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.modalActions}>
            <Pressable style={styles.cancelBtn} onPress={resetModal} accessibilityRole="button">
              <Text style={styles.cancelBtnText}>रद्द करें</Text>
            </Pressable>
            <Pressable
              testID="family-confirm-btn"
              style={[styles.confirmBtn, (!selectedCustomer || !selectedRelationship) && styles.confirmBtnDisabled]}
              onPress={() => void handleAdd()}
              disabled={saving || !selectedCustomer || !selectedRelationship}
              accessibilityRole="button"
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmBtnText}>जोड़ें</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FamilyChip({ link, onRemove }: { link: FamilyMemberResponse; onRemove: () => void }): React.ReactElement {
  const [pressing, setPressing] = useState(false);
  return (
    <Pressable
      testID={`family-chip-${link.id}`}
      style={[styles.chip, pressing && styles.chipPressing]}
      onLongPress={() => {
        setPressing(false);
        onRemove();
      }}
      onPressIn={() => setPressing(true)}
      onPressOut={() => setPressing(false)}
      accessibilityRole="button"
      accessibilityLabel={`${RELATIONSHIP_LABELS[link.relationship] ?? link.relationship} — ${link.relatedName}. हटाने के लिए देर तक दबाएं।`}
    >
      <Text style={styles.chipLabel}>{RELATIONSHIP_LABELS[link.relationship] ?? link.relationship}</Text>
      <Text style={styles.chipName}>{link.relatedName}</Text>
    </Pressable>
  );
}

interface CustomerSearchInputProps {
  value: string;
  onSearch: (q: string) => Promise<void>;
  results: FamilySearchResult[];
  selected: FamilySearchResult | null;
  onSelect: (c: FamilySearchResult) => void;
}

function CustomerSearchInput({ value, onSearch, results, selected, onSelect }: CustomerSearchInputProps): React.ReactElement {
  return (
    <View>
      <TextInput
        testID="family-search-input"
        style={styles.searchInput}
        placeholder="ग्राहक का नाम या फोन खोजें"
        value={value}
        onChangeText={(t: string) => void onSearch(t)}
        accessibilityLabel="ग्राहक खोजें"
      />
      {selected ? (
        <View style={styles.selectedCustomer}>
          <Text style={styles.selectedName}>{selected.name}</Text>
          <Text style={styles.selectedPhone}>{selected.phone}</Text>
        </View>
      ) : (
        results.map((r) => (
          <Pressable key={r.id} style={styles.searchResult} onPress={() => onSelect(r)}>
            <Text style={styles.selectedName}>{r.name}</Text>
            <Text style={styles.selectedPhone}>{r.phone}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingVertical: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#3D2B00' },
  emptyText: { fontSize: 14, color: '#888', fontStyle: 'italic' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#B8860B',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start',
    minHeight: 44,
  },
  chipPressing: { opacity: 0.7 },
  chipLabel: { fontSize: 12, color: '#7A5400', fontWeight: '600' },
  chipName: { fontSize: 14, color: '#3D2B00' },
  addBtn: {
    minHeight: 48, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#B8860B', borderStyle: 'dashed',
    borderRadius: 8, marginTop: 4,
  },
  addBtnText: { color: '#7A5400', fontSize: 14, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#FFFBF2', padding: 20, gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#3D2B00', marginTop: 40 },
  searchInput: {
    borderWidth: 1, borderColor: '#D4A017', borderRadius: 8,
    padding: 12, fontSize: 16, backgroundColor: '#fff', minHeight: 48,
  },
  selectedCustomer: {
    backgroundColor: '#FFF8E1', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#B8860B',
  },
  selectedName: { fontSize: 15, fontWeight: '600', color: '#3D2B00' },
  selectedPhone: { fontSize: 13, color: '#666' },
  searchResult: {
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee',
    minHeight: 48, justifyContent: 'center',
  },
  relPicker: { gap: 8 },
  label: { fontSize: 15, fontWeight: '600', color: '#3D2B00' },
  relGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  relChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: '#B8860B', backgroundColor: '#FFF8E1', minHeight: 44,
    justifyContent: 'center',
  },
  relChipSelected: { backgroundColor: '#B8860B', borderColor: '#7A5400' },
  relChipText: { fontSize: 14, color: '#7A5400', fontWeight: '500' },
  relChipTextSelected: { color: '#fff' },
  error: { color: '#B1402B', fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 'auto' },
  cancelBtn: {
    flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: '#f5f5f5',
  },
  cancelBtnText: { fontSize: 15, color: '#555' },
  confirmBtn: {
    flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#B8860B', borderRadius: 8,
  },
  confirmBtnDisabled: { backgroundColor: '#ccc' },
  confirmBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});
