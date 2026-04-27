import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  hardDeleteAt: string | null; // ISO string when set, null when not soft-deleted
}

const HINDI_MONTHS = [
  'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर',
];

function formatHindiDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${HINDI_MONTHS[d.getMonth()]}`;
}

// Story 6.8 — Pending-deletion banner shown on the customer profile screen
// once a deletion request has been logged. The customer is filtered out of
// list/search but the OWNER can still navigate by saved id.
export function DeletionStatusBanner({ hardDeleteAt }: Props): React.ReactElement | null {
  if (!hardDeleteAt) return null;
  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLabel={`हटाने का अनुरोध दर्ज है, स्थायी हटाव ${formatHindiDate(hardDeleteAt)}`}
    >
      <Text style={styles.icon}>⏳</Text>
      <View style={styles.body}>
        <Text style={styles.headline}>हटाने का अनुरोध दर्ज है</Text>
        <Text style={styles.detail}>{formatHindiDate(hardDeleteAt)} को स्थायी रूप से हटाया जाएगा</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFF3D6',
    borderLeftWidth: 4,
    borderLeftColor: '#B8860B',
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 8,
  },
  icon: { fontSize: 20 },
  body: { flex: 1, gap: 2 },
  headline: { fontSize: 14, fontWeight: '700', color: '#7A5400' },
  detail:   { fontSize: 13, color: '#3D2B00' },
});
