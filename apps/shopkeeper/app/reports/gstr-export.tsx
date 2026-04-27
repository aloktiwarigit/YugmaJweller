import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Share } from 'react-native';
import { api } from '../../src/api/client';

type GstrType = 'gstr1' | 'gstr3b';

interface GstrResponse { csv: string; filename: string; }

function getPreviousMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return new Intl.DateTimeFormat('hi-IN', { month: 'long', year: 'numeric' }).format(d);
}

// MVP scope: the CSV is shared as message text via React Native's Share API.
// Receiver apps cap EXTRA_TEXT around 100 KB on Android, so very large months
// will be truncated by the receiver. SHARE_TEXT_LIMIT_BYTES forces a clear
// Hindi error in that case rather than silently producing a corrupt file.
// Phase-4 follow-up: wire expo-file-system + expo-sharing to write the CSV
// to documentDirectory and pass a file URI to Sharing.shareAsync().
const SHARE_TEXT_LIMIT_BYTES = 80 * 1024;

class GstrTooLargeError extends Error {
  constructor() { super('csv_too_large_for_share'); }
}

function utf8ByteLength(s: string): number {
  // TextEncoder is available in modern React Native (Hermes 0.74+).
  return new TextEncoder().encode(s).length;
}

async function downloadGstr(month: string, type: GstrType): Promise<void> {
  const res = await api.get<GstrResponse>('/api/v1/billing/compliance/gstr', { params: { month, type } });
  if (utf8ByteLength(res.data.csv) > SHARE_TEXT_LIMIT_BYTES) throw new GstrTooLargeError();
  await Share.share({ title: res.data.filename, message: res.data.csv });
}

export default function GstrExportScreen(): JSX.Element {
  const [month, setMonth] = useState(getPreviousMonth());
  const [exporting, setExporting] = useState<GstrType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (type: GstrType): Promise<void> => {
    setError(null);
    setExporting(type);
    try {
      await downloadGstr(month, type);
    } catch (err) {
      if (err instanceof GstrTooLargeError) {
        setError('यह महीना बहुत बड़ा है — कृपया छोटा महीना चुनें या CI से डाउनलोड करें।');
      } else {
        setError('Export नहीं हो सका। दोबारा कोशिश करें।');
      }
    } finally {
      setExporting(null);
    }
  };

  const shiftMonth = (delta: number): void => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y!, m! - 1, 1);
    d.setMonth(d.getMonth() + delta);
    const now = new Date();
    if (d < new Date(now.getFullYear(), now.getMonth(), 1)) {
      setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, styles.deva]}>GST रिपोर्ट डाउनलोड</Text>

      <View style={styles.monthPicker}>
        <Pressable onPress={() => shiftMonth(-1)} style={styles.arrow} accessibilityLabel="पिछला महीना" hitSlop={12}>
          <Text style={styles.arrowText}>{'<'}</Text>
        </Pressable>
        <Text style={[styles.monthLabel, styles.deva]}>{formatMonthLabel(month)}</Text>
        <Pressable onPress={() => shiftMonth(1)} style={styles.arrow} accessibilityLabel="अगला महीना" hitSlop={12}>
          <Text style={styles.arrowText}>{'>'}</Text>
        </Pressable>
      </View>

      {error ? <Text style={[styles.errorText, styles.deva]}>{error}</Text> : null}

      <View style={styles.btnRow}>
        <Pressable
          style={({ pressed }) => [styles.exportBtn, pressed && styles.btnPressed]}
          onPress={() => void handleExport('gstr1')}
          disabled={exporting !== null}
          accessibilityRole="button"
          accessibilityLabel="GSTR-1 CSV डाउनलोड करें"
        >
          {exporting === 'gstr1'
            ? <ActivityIndicator color="#fff" />
            : <Text style={[styles.btnText, styles.deva]}>GSTR-1 डाउनलोड</Text>}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.exportBtn, styles.btnSecondary, pressed && styles.btnPressed]}
          onPress={() => void handleExport('gstr3b')}
          disabled={exporting !== null}
          accessibilityRole="button"
          accessibilityLabel="GSTR-3B CSV डाउनलोड करें"
        >
          {exporting === 'gstr3b'
            ? <ActivityIndicator color="#d4a84b" />
            : <Text style={[styles.btnText, styles.btnSecondaryText, styles.deva]}>GSTR-3B डाउनलोड</Text>}
        </Pressable>
      </View>

      <Text style={[styles.hint, styles.deva]}>
        CSV फ़ाइल GST पोर्टल पर upload के लिए तैयार रहेगी।
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#fafaf9', padding: 20 },
  title:            { fontSize: 22, fontWeight: '700', color: '#1c1917', marginBottom: 24 },
  monthPicker:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  arrow:            { paddingHorizontal: 16, paddingVertical: 8, minHeight: 48, justifyContent: 'center' },
  arrowText:        { fontSize: 24, color: '#d4a84b', lineHeight: 28 },
  monthLabel:       { fontSize: 18, fontWeight: '600', color: '#1c1917', minWidth: 160, textAlign: 'center' },
  btnRow:           { gap: 12 },
  exportBtn:        { backgroundColor: '#d4a84b', borderRadius: 12, paddingVertical: 16, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  btnSecondary:     { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#d4a84b' },
  btnPressed:       { opacity: 0.8 },
  btnText:          { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  btnSecondaryText: { color: '#d4a84b' },
  errorText:        { color: '#b91c1c', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  hint:             { marginTop: 20, fontSize: 13, color: '#78716c', textAlign: 'center' },
  deva:             { fontFamily: 'NotoSansDevanagari' },
});
