import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Share, ActivityIndicator } from 'react-native';

export interface StrDownloadCardProps {
  shopBaseUrl: string;
  authToken:   string;
}

export function StrDownloadCard({
  shopBaseUrl,
  authToken,
}: StrDownloadCardProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleDownload(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const url = `${shopBaseUrl}/api/v1/billing/compliance/str-template`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${authToken}` } });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { text: string };
      await Share.share({ message: data.text, title: 'STR-template.txt' });
    } catch {
      setError('STR टेम्पलेट लोड नहीं हो सका। दोबारा कोशिश करें।');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.header}>
        <Text style={styles.icon} accessibilityElementsHidden>⚠️</Text>
        <Text style={styles.title}>संदिग्ध लेनदेन रिपोर्ट (STR)</Text>
      </View>
      <Text style={styles.message}>
        7 कार्य दिवसों में FIU-IND को सबमिट करें।{'\n'}
        कोई न्यूनतम राशि सीमा नहीं — किसी भी संदिग्ध लेनदेन की रिपोर्ट करें।
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        onPress={handleDownload}
        style={styles.downloadBtn}
        accessibilityRole="button"
        accessibilityLabel="STR टेम्पलेट डाउनलोड करें"
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.downloadBtnText}>STR टेम्पलेट डाउनलोड करें</Text>
        }
      </Pressable>
    </View>
  );
}

const RED       = '#DC2626';
const RED_LIGHT = '#FEF2F2';
const RED_DARK  = '#991B1B';

const styles = StyleSheet.create({
  card: {
    backgroundColor: RED_LIGHT,
    borderLeftWidth: 4,
    borderLeftColor: RED,
    borderRadius:    8,
    padding:         16,
    marginVertical:  8,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  8,
  },
  icon: {
    fontSize:    20,
    marginRight: 8,
  },
  title: {
    fontSize:   16,
    fontWeight: '700',
    color:      RED_DARK,
    fontFamily: 'NotoSansDevanagari',
  },
  message: {
    fontSize:     14,
    color:        '#7F1D1D',
    lineHeight:   22,
    marginBottom: 12,
    fontFamily:   'NotoSansDevanagari',
  },
  errorText: {
    fontSize:     13,
    color:        RED,
    marginBottom: 8,
    fontFamily:   'NotoSansDevanagari',
  },
  downloadBtn: {
    backgroundColor:   RED,
    borderRadius:      6,
    paddingVertical:   12,
    paddingHorizontal: 16,
    alignItems:        'center',
    minHeight:         48,
    justifyContent:    'center',
  },
  downloadBtnText: {
    color:      '#fff',
    fontSize:   16,
    fontWeight: '600',
    fontFamily: 'NotoSansDevanagari',
  },
});
