import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, Alert,
  StyleSheet, ActivityIndicator,
} from 'react-native';

export interface NoteResponse {
  id: string;
  customerId: string;
  body: string;
  authorUserId: string;
  createdAt: string;
  updatedAt: string;
}

const HINDI_MONTHS: string[] = [
  'जन', 'फर', 'मार', 'अप्र', 'मई', 'जून',
  'जुल', 'अग', 'सित', 'अक्त', 'नव', 'दिस',
];

function relativeTimeHindi(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((nowMidnight.getTime() - dateMidnight.getTime()) / 86400000);

  if (diffDays === 0) return 'आज';
  if (diffDays === 1) return 'कल';
  if (diffDays < 7) return `${diffDays} दिन पहले`;

  const day = date.getDate();
  const month = HINDI_MONTHS[date.getMonth()];
  return `${day} ${month}`;
}

interface Props {
  customerId: string;
  notes: NoteResponse[];
  currentUserId: string;
  currentUserRole: string;
  authorNameMap?: Record<string, string>;
  loading?: boolean;
  onAddNote: (body: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

export function NotesSection({
  notes,
  currentUserId,
  currentUserRole,
  authorNameMap = {},
  loading,
  onAddNote,
  onDeleteNote,
}: Props): React.ReactElement {
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(): Promise<void> {
    const body = inputText.trim();
    if (!body) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAddNote(body);
      setInputText('');
    } catch {
      setError('नोट जोड़ने में समस्या हुई। पुनः प्रयास करें।');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeletePress(note: NoteResponse): void {
    const canDelete =
      currentUserId === note.authorUserId || currentUserRole === 'shop_admin';
    if (!canDelete) {
      Alert.alert('अनुमति नहीं', 'केवल लेखक/owner हटा सकते');
      return;
    }
    Alert.alert(
      'नोट हटाएं',
      'क्या आप इस नोट को हटाना चाहते हैं?',
      [
        { text: 'रद्द करें', style: 'cancel' },
        {
          text: 'हटाएं',
          style: 'destructive',
          onPress: () => {
            setActiveNoteId(null);
            void onDeleteNote(note.id);
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>नोट्स</Text>

      {loading ? (
        <ActivityIndicator color="#B8860B" />
      ) : (
        <>
          {notes.length === 0 ? (
            <Text style={styles.emptyText}>कोई नोट नहीं जोड़ा गया</Text>
          ) : (
            <FlatList
              data={notes}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <NoteRow
                  note={item}
                  authorName={authorNameMap[item.authorUserId] ?? 'कर्मचारी'}
                  isActive={activeNoteId === item.id}
                  canDelete={
                    currentUserId === item.authorUserId ||
                    currentUserRole === 'shop_admin'
                  }
                  onLongPress={() =>
                    setActiveNoteId(activeNoteId === item.id ? null : item.id)
                  }
                  onDelete={() => handleDeletePress(item)}
                />
              )}
            />
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.inputRow}>
        <TextInput
          testID="note-input"
          style={styles.textInput}
          placeholder="नोट लिखें..."
          placeholderTextColor="#AAA"
          value={inputText}
          onChangeText={setInputText}
          multiline
          accessibilityLabel="नोट लिखें"
        />
        <Pressable
          testID="note-submit-btn"
          style={[styles.sendBtn, (!inputText.trim() || submitting) && styles.sendBtnDisabled]}
          onPress={() => void handleAdd()}
          disabled={!inputText.trim() || submitting}
          accessibilityRole="button"
          accessibilityLabel="नोट जमा करें"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendBtnText}>▶</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

interface NoteRowProps {
  note: NoteResponse;
  authorName: string;
  isActive: boolean;
  canDelete: boolean;
  onLongPress: () => void;
  onDelete: () => void;
}

function NoteRow({
  note,
  authorName,
  isActive,
  canDelete,
  onLongPress,
  onDelete,
}: NoteRowProps): React.ReactElement {
  return (
    <Pressable
      testID={`note-row-${note.id}`}
      style={[styles.noteRow, isActive && styles.noteRowActive]}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${authorName} का नोट। हटाने के लिए देर तक दबाएं।`}
    >
      <View style={styles.noteMeta}>
        <Text style={styles.authorText}>{authorName}</Text>
        <Text style={styles.metaSeparator}> · </Text>
        <Text style={styles.timeText}>{relativeTimeHindi(note.createdAt)}</Text>
      </View>
      <Text style={styles.noteBody}>{note.body}</Text>

      {isActive && (
        <View style={styles.deleteRow}>
          {canDelete ? (
            <Pressable
              testID={`note-delete-${note.id}`}
              style={styles.deleteBtn}
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel="नोट हटाएं"
            >
              <Text style={styles.deleteBtnText}>हटाएं</Text>
            </Pressable>
          ) : (
            <Text style={styles.deleteDisabledText}>
              केवल लेखक/owner हटा सकते
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingVertical: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#3D2B00' },
  emptyText: { fontSize: 14, color: '#888', fontStyle: 'italic' },

  noteRow: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#E8D08A',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  noteRowActive: {
    borderColor: '#B8860B',
    backgroundColor: '#FFF3CC',
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorText: { fontSize: 13, fontWeight: '600', color: '#7A5400' },
  metaSeparator: { fontSize: 13, color: '#AAA' },
  timeText: { fontSize: 13, color: '#999' },
  noteBody: { fontSize: 15, color: '#3D2B00', lineHeight: 22 },
  deleteRow: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
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
  deleteDisabledText: { fontSize: 12, color: '#999', fontStyle: 'italic' },

  error: { color: '#B1402B', fontSize: 14 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#D4A017',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#3D2B00',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#B8860B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendBtnText: { fontSize: 16, color: '#fff' },
});
