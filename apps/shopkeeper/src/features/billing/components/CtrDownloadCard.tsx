import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Share, ActivityIndicator } from 'react-native';

export interface CtrDownloadCardProps {
  customerId:    string | null;
  customerPhone: string | null;
  monthStr:      string;
  shopBaseUrl:   string;
  authToken:     string;
}

export function CtrDownloadCard({
  customerId,
  customerPhone,
  monthStr,
  shopBaseUrl,
  authToken,
}: CtrDownloadCardProps): React.JSX.Element {
  const [loading, setLoading]         = useState(false);
  const [ackNumber, setAckNumber]     = useState('');
  const [ackSaved, setAckSaved]       = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function handleDownload(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month: monthStr });
      if (customerId)    params.set('customerId', customerId);
      if (customerPhone) params.set('customerPhone', customerPhone);
      const url = `${shopBaseUrl}/api/v1/billing/compliance/ctr?${params.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { text: string };
      await Share.share({ message: data.text, title: `CTR-${monthStr}.txt` });
    } catch {
      setError('CTR लोड नहीं हो सका। दोबारा कोशिश करें।');
    } finally {
      setLoading(false);
    }
  }

  function handleAckSave(): void {
    if (ackNumber.trim().length > 3) {
      setAckSaved(true);
    }
  }

  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.header}>
        <Text style={styles.icon} accessibilityElementsHidden>⚠️</Text>
        <Text style={styles.title}>PMLA सीमा पार हो गई</Text>
      </View>
      <Text style={styles.message}>
        इस ग्राहक की {monthStr} महीने की cash {'₹'}10,00,000 की सीमा पार हो गई है।
        FIU-IND को CTR रिपोर्ट फ़ाइल करें।
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        onPress={handleDownload}
        style={styles.downloadBtn}
        accessibilityRole="button"
        accessibilityLabel="CTR रिपोर्ट डाउनलोड करें"
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.downloadBtnText}>CTR डाउनलोड करें</Text>
        }
      </Pressable>

      <View style={styles.ackRow}>
        <TextInput
          style={styles.ackInput}
          placeholder="FIU-IND Ack नंबर"
          value={ackNumber}
          onChangeText={setAckNumber}
          accessibilityLabel="FIU-IND acknowledgement number"
          editable={!ackSaved}
        />
        <Pressable
          onPress={handleAckSave}
          style={[styles.ackBtn, ackSaved && styles.ackBtnSaved]}
          accessibilityRole="button"
          accessibilityLabel="फाइलिंग हो गई"
          disabled={ackSaved}
        >
          <Text style={styles.ackBtnText}>
            {ackSaved ? 'सेव हो गया ✓' : 'फाइलिंग हो गई'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const AMBER = '#F59E0B';
const AMBER_LIGHT = '#FFF7E6';
const AMBER_DARK = '#B45309';

const styles = StyleSheet.create({
  card: {
    backgroundColor: AMBER_LIGHT,
    borderLeftWidth: 4,
    borderLeftColor: AMBER,
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: AMBER_DARK,
    fontFamily: 'NotoSansDevanagari',
  },
  message: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 22,
    marginBottom: 12,
    fontFamily: 'NotoSansDevanagari',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginBottom: 8,
    fontFamily: 'NotoSansDevanagari',
  },
  downloadBtn: {
    backgroundColor: AMBER,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: 12,
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'NotoSansDevanagari',
  },
  ackRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ackInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: AMBER,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 44,
    backgroundColor: '#fff',
  },
  ackBtn: {
    backgroundColor: AMBER_DARK,
    borderRadius: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 100,
  },
  ackBtnSaved: {
    backgroundColor: '#059669',
  },
  ackBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'NotoSansDevanagari',
  },
});
