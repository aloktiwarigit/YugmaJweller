import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Linking, Share, StyleSheet } from 'react-native';
import { colors } from '@goldsmith/ui-tokens';
import { api } from '../../../api/client';
import { useReportExport, type ReportType } from '../useReportExport';

const GOLD = '#B58A3C';

// Mirror of the existing GSTR pattern (apps/shopkeeper/app/reports/gstr-export.tsx:28).
// Android Share API caps EXTRA_TEXT around ~100 KB; we surface a clear Hindi error
// at 80 KB rather than letting the system silently truncate. Stock-aging in large
// shops is the most likely report to hit this — instruct user to use PDF instead.
const SHARE_TEXT_LIMIT_BYTES = 80 * 1024;

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

interface ExportButtonsProps {
  reportType: ReportType;
  csvParams?: Record<string, string | number | undefined>;
  pdfParams?: Record<string, unknown>;
}

export function ExportButtons(props: ExportButtonsProps): React.ReactElement {
  const { reportType, csvParams = {}, pdfParams } = props;
  const pdf = useReportExport(reportType);

  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const onCsvPress = async (): Promise<void> => {
    setCsvError(null);
    setCsvBusy(true);
    try {
      const res = await api.get<{ csv: string; filename: string }>(
        `/api/v1/reports/${reportType}.csv`,
        { params: csvParams },
      );
      if (utf8ByteLength(res.data.csv) > SHARE_TEXT_LIMIT_BYTES) {
        setCsvError('यह रिपोर्ट बहुत बड़ी है — कृपया PDF का उपयोग करें।');
        return;
      }
      await Share.share({ title: res.data.filename, message: res.data.csv });
    } catch {
      setCsvError('CSV डाउनलोड नहीं हो सका। दोबारा कोशिश करें।');
    } finally {
      setCsvBusy(false);
    }
  };

  const onPdfPress = (): void => {
    if (pdf.status === 'IDLE' || pdf.status === 'FAILED') {
      pdf.start(pdfParams);
    } else if (pdf.status === 'READY' && pdf.downloadUrl) {
      void Linking.openURL(pdf.downloadUrl);
    }
  };

  const pdfLabel = ({
    IDLE:    'PDF डाउनलोड',
    QUEUED:  'तैयार हो रहा...',
    RUNNING: 'तैयार हो रहा...',
    READY:   'PDF खोलें',
    FAILED:  'पुनः प्रयास',
  })[pdf.status];

  const isPdfBusy = pdf.status === 'QUEUED' || pdf.status === 'RUNNING';

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onCsvPress}
          disabled={csvBusy}
          style={[styles.csvBtn, csvBusy && styles.btnBusy]}
          accessibilityRole="button"
          accessibilityLabel="CSV डाउनलोड"
          accessibilityState={{ disabled: csvBusy }}
        >
          {csvBusy && <ActivityIndicator size="small" color={GOLD} style={{ marginRight: 8 }} />}
          <Text style={styles.csvBtnText}>CSV डाउनलोड</Text>
        </Pressable>

        <Pressable
          onPress={onPdfPress}
          disabled={isPdfBusy}
          style={[styles.pdfBtn, isPdfBusy && styles.pdfBtnBusy]}
          accessibilityRole="button"
          accessibilityLabel={pdfLabel}
          accessibilityState={{ disabled: isPdfBusy }}
        >
          {isPdfBusy && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
          <Text style={styles.pdfBtnText}>{pdfLabel}</Text>
        </Pressable>
      </View>

      {csvError && (
        <Text style={styles.errorText} numberOfLines={2}>{csvError}</Text>
      )}
      {pdf.status === 'FAILED' && pdf.errorMessage && (
        <Text style={styles.errorText} numberOfLines={2}>
          त्रुटि: {pdf.errorMessage}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { marginVertical: 12 },
  buttonRow:     { flexDirection: 'row', gap: 8 },
  csvBtn:        { flexGrow: 1, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: GOLD, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  csvBtnText:    { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: GOLD, fontWeight: '600' },
  pdfBtn:        { flexGrow: 1, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  pdfBtnBusy:    { backgroundColor: '#A07832' },
  pdfBtnText:    { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: '#fff', fontWeight: '600' },
  btnBusy:       { opacity: 0.7 },
  errorText:     { fontFamily: 'NotoSansDevanagari', fontSize: 12, color: colors.error, marginTop: 4 },
});
