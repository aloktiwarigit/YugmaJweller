import React, { useState } from 'react';
import {
  View, Text, Pressable, FlatList, Modal, Alert,
  StyleSheet, ActivityIndicator, TextInput, ScrollView,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OccasionRow {
  id: string;
  customerId: string;
  occasionType: string;
  label: string | null;
  monthDay: string;        // 'MM-DD'
  nextOccurrence: string | null;  // YYYY-MM-DD
  reminderDays: number;
  createdAt: string;
}

interface Props {
  customerId: string;
  occasions: OccasionRow[];
  loading?: boolean;
  onAddOccasion: (dto: { occasionType: string; monthDay: string; label?: string }) => Promise<void>;
  onDeleteOccasion: (occasionId: string) => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OCCASION_TYPES = ['BIRTHDAY', 'ANNIVERSARY', 'FESTIVAL', 'OTHER'] as const;
type OccasionType = typeof OCCASION_TYPES[number];

const OCCASION_LABELS: Record<OccasionType, string> = {
  BIRTHDAY:    '🎂 जन्मदिन',
  ANNIVERSARY: '💍 सालगिरह',
  FESTIVAL:    '🎉 त्योहार',
  OTHER:       '📅 अन्य',
};

const HINDI_MONTHS_FULL: string[] = [
  'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितम्बर', 'अक्टूबर', 'नवम्बर', 'दिसम्बर',
];

const HINDI_MONTHS_SHORT: string[] = [
  'जन', 'फर', 'मार', 'अप्र', 'मई', 'जून',
  'जुल', 'अग', 'सित', 'अक्त', 'नव', 'दिस',
];

/** Max days per month (non-leap Feb = 28). */
function maxDaysInMonth(month: number): number {
  // month is 1-indexed
  if (month === 2) return 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

// ─── Days-until calculation ───────────────────────────────────────────────────

function daysUntilBadge(nextOccurrence: string | null): string {
  if (!nextOccurrence) return 'बीत गया';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = nextOccurrence.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'बीत गया';
  if (diff === 0) return 'आज!';
  return `${diff} दिन बाद`;
}

function badgeStyle(nextOccurrence: string | null): object {
  if (!nextOccurrence) return styles.badgePast;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = nextOccurrence.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return styles.badgePast;
  if (diff === 0) return styles.badgeToday;
  if (diff <= 30) return styles.badgeSoon;
  return styles.badgeUpcoming;
}

function formatMonthDay(monthDay: string): string {
  const [mm, dd] = monthDay.split('-').map(Number);
  return `${dd} ${HINDI_MONTHS_FULL[mm - 1] ?? ''}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OccasionsSection({
  occasions,
  loading,
  onAddOccasion,
  onDeleteOccasion,
}: Props): React.ReactElement {
  const [showModal, setShowModal] = useState(false);
  const [activeOccasionId, setActiveOccasionId] = useState<string | null>(null);

  function handleDeletePress(occasion: OccasionRow): void {
    Alert.alert(
      'अवसर हटाएं',
      `क्या आप "${OCCASION_LABELS[occasion.occasionType as OccasionType] ?? occasion.occasionType}" हटाना चाहते हैं?`,
      [
        { text: 'रद्द करें', style: 'cancel' },
        {
          text: 'हटाएं',
          style: 'destructive',
          onPress: () => {
            setActiveOccasionId(null);
            void onDeleteOccasion(occasion.id);
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>अवसर</Text>

      {loading ? (
        <ActivityIndicator color="#B8860B" />
      ) : (
        <>
          {occasions.length === 0 ? (
            <Text style={styles.emptyText}>कोई अवसर नहीं जोड़ा गया</Text>
          ) : (
            <FlatList
              data={occasions}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <OccasionItemRow
                  occasion={item}
                  isActive={activeOccasionId === item.id}
                  onLongPress={() =>
                    setActiveOccasionId(activeOccasionId === item.id ? null : item.id)
                  }
                  onDelete={() => handleDeletePress(item)}
                />
              )}
            />
          )}

          <Pressable
            testID="occasion-add-btn"
            style={styles.addBtn}
            onPress={() => setShowModal(true)}
            accessibilityRole="button"
            accessibilityLabel="अवसर जोड़ें"
          >
            <Text style={styles.addBtnText}>+ अवसर जोड़ें</Text>
          </Pressable>
        </>
      )}

      <AddOccasionModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={async (dto) => {
          await onAddOccasion(dto);
          setShowModal(false);
        }}
      />
    </View>
  );
}

// ─── Occasion Row ─────────────────────────────────────────────────────────────

interface OccasionItemRowProps {
  occasion: OccasionRow;
  isActive: boolean;
  onLongPress: () => void;
  onDelete: () => void;
}

function OccasionItemRow({
  occasion,
  isActive,
  onLongPress,
  onDelete,
}: OccasionItemRowProps): React.ReactElement {
  const typeLabel = OCCASION_LABELS[occasion.occasionType as OccasionType] ?? `📅 ${occasion.occasionType}`;
  const dateLabel = formatMonthDay(occasion.monthDay);
  const badge = daysUntilBadge(occasion.nextOccurrence);
  const bStyle = badgeStyle(occasion.nextOccurrence);

  return (
    <Pressable
      testID={`occasion-row-${occasion.id}`}
      style={[styles.occasionRow, isActive && styles.occasionRowActive]}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel}, ${dateLabel}। हटाने के लिए देर तक दबाएं।`}
    >
      <View style={styles.occasionMain}>
        <View style={styles.occasionLeft}>
          <Text style={styles.typeLabel}>{typeLabel}</Text>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          {occasion.label ? (
            <Text style={styles.customLabel}>{occasion.label}</Text>
          ) : null}
        </View>
        <View style={[styles.badge, bStyle]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      </View>

      {isActive && (
        <View style={styles.deleteRow}>
          <Pressable
            testID={`occasion-delete-${occasion.id}`}
            style={styles.deleteBtn}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="अवसर हटाएं"
          >
            <Text style={styles.deleteBtnText}>हटाएं</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

// ─── Add Occasion Modal ───────────────────────────────────────────────────────

interface AddOccasionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (dto: { occasionType: string; monthDay: string; label?: string }) => Promise<void>;
}

function AddOccasionModal({ visible, onClose, onSubmit }: AddOccasionModalProps): React.ReactElement {
  const [selectedType, setSelectedType] = useState<OccasionType | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);  // 1-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [labelText, setLabelText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxDays = selectedMonth != null ? maxDaysInMonth(selectedMonth) : 31;
  // If selected day exceeds max for new month, reset it
  const effectiveDay = selectedDay != null && selectedDay <= maxDays ? selectedDay : null;

  const canSubmit = selectedType != null && selectedMonth != null && effectiveDay != null;

  function resetForm(): void {
    setSelectedType(null);
    setSelectedMonth(null);
    setSelectedDay(null);
    setLabelText('');
    setError(null);
  }

  function handleClose(): void {
    resetForm();
    onClose();
  }

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return;
    const mm = String(selectedMonth).padStart(2, '0');
    const dd = String(effectiveDay).padStart(2, '0');
    const monthDay = `${mm}-${dd}`;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        occasionType: selectedType as string,
        monthDay,
        label: labelText.trim() || undefined,
      });
      resetForm();
    } catch {
      setError('अवसर जोड़ने में समस्या हुई। पुनः प्रयास करें।');
    } finally {
      setSubmitting(false);
    }
  }

  // Day grid: only show valid days for selected month
  const dayNumbers = Array.from({ length: maxDays }, (_, i) => i + 1);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <ScrollView
        style={styles.modalScroll}
        contentContainerStyle={styles.modalContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.modalTitle}>अवसर जोड़ें</Text>

        {/* Type selector */}
        <Text style={styles.fieldLabel}>अवसर का प्रकार</Text>
        <View style={styles.chipGrid}>
          {OCCASION_TYPES.map((type) => (
            <Pressable
              key={type}
              testID={`occasion-type-${type}`}
              style={[styles.typeChip, selectedType === type && styles.typeChipSelected]}
              onPress={() => setSelectedType(type)}
              accessibilityRole="button"
              accessibilityLabel={OCCASION_LABELS[type]}
              accessibilityState={{ selected: selectedType === type }}
            >
              <Text style={[styles.typeChipText, selectedType === type && styles.typeChipTextSelected]}>
                {OCCASION_LABELS[type]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Month picker */}
        <Text style={styles.fieldLabel}>महीना</Text>
        <View style={styles.monthGrid}>
          {HINDI_MONTHS_SHORT.map((name, idx) => {
            const month = idx + 1;
            return (
              <Pressable
                key={month}
                testID={`occasion-month-${month}`}
                style={[styles.monthChip, selectedMonth === month && styles.monthChipSelected]}
                onPress={() => {
                  setSelectedMonth(month);
                  // Reset day if it would be invalid in new month
                  if (selectedDay != null && selectedDay > maxDaysInMonth(month)) {
                    setSelectedDay(null);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={HINDI_MONTHS_FULL[idx]}
                accessibilityState={{ selected: selectedMonth === month }}
              >
                <Text style={[styles.monthChipText, selectedMonth === month && styles.monthChipTextSelected]}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Day picker */}
        <Text style={styles.fieldLabel}>तारीख</Text>
        <View style={styles.dayGrid}>
          {dayNumbers.map((day) => (
            <Pressable
              key={day}
              testID={`occasion-day-${day}`}
              style={[styles.dayChip, effectiveDay === day && styles.dayChipSelected]}
              onPress={() => setSelectedDay(day)}
              accessibilityRole="button"
              accessibilityLabel={`${day}`}
              accessibilityState={{ selected: effectiveDay === day }}
            >
              <Text style={[styles.dayChipText, effectiveDay === day && styles.dayChipTextSelected]}>
                {day}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Optional label */}
        <Text style={styles.fieldLabel}>लेबल (वैकल्पिक)</Text>
        <TextInput
          testID="occasion-label-input"
          style={styles.labelInput}
          placeholder="जैसे: माँ का जन्मदिन"
          placeholderTextColor="#AAA"
          value={labelText}
          onChangeText={setLabelText}
          accessibilityLabel="अवसर का लेबल"
          maxLength={100}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Actions */}
        <View style={styles.modalActions}>
          <Pressable
            style={styles.cancelBtn}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="रद्द करें"
          >
            <Text style={styles.cancelBtnText}>रद्द करें</Text>
          </Pressable>
          <Pressable
            testID="occasion-submit-btn"
            style={[styles.confirmBtn, (!canSubmit || submitting) && styles.confirmBtnDisabled]}
            onPress={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
            accessibilityRole="button"
            accessibilityLabel="अवसर जोड़ें"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>जोड़ें</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: 12, paddingVertical: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#3D2B00' },
  emptyText: { fontSize: 14, color: '#888', fontStyle: 'italic' },

  // Occasion row
  occasionRow: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#E8D08A',
    borderRadius: 8,
    padding: 12,
    gap: 6,
    minHeight: 64,
  },
  occasionRowActive: {
    borderColor: '#B8860B',
    backgroundColor: '#FFF3CC',
  },
  occasionMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  occasionLeft: { flex: 1, gap: 2 },
  typeLabel: { fontSize: 15, fontWeight: '600', color: '#3D2B00' },
  dateLabel: { fontSize: 14, color: '#7A5400' },
  customLabel: { fontSize: 13, color: '#999', fontStyle: 'italic' },

  // Badges
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeUpcoming: { backgroundColor: '#E8F5E9' },
  badgeSoon: { backgroundColor: '#FFF3E0' },
  badgeToday: { backgroundColor: '#FCE4EC' },
  badgePast: { backgroundColor: '#F5F5F5' },

  // Delete
  deleteRow: { marginTop: 4, alignItems: 'flex-end' },
  deleteBtn: {
    minHeight: 48,
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#B1402B',
    borderRadius: 6,
    paddingHorizontal: 16,
  },
  deleteBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },

  // Add button
  addBtn: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B8860B',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 4,
  },
  addBtnText: { color: '#7A5400', fontSize: 14, fontWeight: '600' },

  // Modal
  modalScroll: { flex: 1, backgroundColor: '#FFFBF2' },
  modalContent: { padding: 20, gap: 12, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#3D2B00', marginTop: 40, marginBottom: 8 },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: '#3D2B00', marginTop: 4 },

  // Type chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#B8860B',
    backgroundColor: '#FFF8E1',
    minHeight: 48,
    justifyContent: 'center',
  },
  typeChipSelected: { backgroundColor: '#B8860B', borderColor: '#7A5400' },
  typeChipText: { fontSize: 14, color: '#7A5400', fontWeight: '500' },
  typeChipTextSelected: { color: '#fff' },

  // Month grid — 4 per row
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthChip: {
    width: '22%',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4A017',
    borderRadius: 8,
    backgroundColor: '#FFF8E1',
  },
  monthChipSelected: { backgroundColor: '#B8860B', borderColor: '#7A5400' },
  monthChipText: { fontSize: 13, color: '#7A5400', fontWeight: '500' },
  monthChipTextSelected: { color: '#fff' },

  // Day grid — 7 per row
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dayChip: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4A017',
    borderRadius: 6,
    backgroundColor: '#FFF8E1',
  },
  dayChipSelected: { backgroundColor: '#B8860B', borderColor: '#7A5400' },
  dayChipText: { fontSize: 13, color: '#7A5400', fontWeight: '500' },
  dayChipTextSelected: { color: '#fff' },

  // Optional label input
  labelInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D4A017',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#3D2B00',
  },

  errorText: { color: '#B1402B', fontSize: 14 },

  // Modal actions
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  cancelBtnText: { fontSize: 15, color: '#555' },
  confirmBtn: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#B8860B',
    borderRadius: 8,
  },
  confirmBtnDisabled: { backgroundColor: '#ccc' },
  confirmBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});
