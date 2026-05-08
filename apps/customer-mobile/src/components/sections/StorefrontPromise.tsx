import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

interface Pillar {
  icon:       string;
  titleHi:    string;
  descHi:     string;
}

const PILLARS: Pillar[] = [
  {
    icon:    '🏆',
    titleHi: 'BIS / HUID',
    descHi:  'हर उत्पाद हॉलमार्क प्रमाणित',
  },
  {
    icon:    '📊',
    titleHi: 'पारदर्शी मूल्य',
    descHi:  'आज की बाज़ार दर पर सटीक कीमत',
  },
  {
    icon:    '🔄',
    titleHi: 'एक्सचेंज',
    descHi:  'पुराने गहने बदलें, नए लें',
  },
  {
    icon:    '🏠',
    titleHi: 'घर पर ट्राय',
    descHi:  'पसंद आने पर ही खरीदें',
  },
  {
    icon:    '💬',
    titleHi: 'WhatsApp सहायता',
    descHi:  'दुकानदार से सीधे बात करें',
  },
];

export function StorefrontPromise(): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>हमारा वादा</Text>
      <View style={styles.grid}>
        {PILLARS.map((p) => (
          <View key={p.titleHi} style={styles.pillar}>
            <Text style={styles.icon}>{p.icon}</Text>
            <Text style={styles.pillarTitle}>{p.titleHi}</Text>
            <Text style={styles.pillarDesc}>{p.descHi}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xl,
  },
  title: {
    fontFamily:   typography.display.family,
    fontSize:     24,
    color:        colors.ink,
    marginBottom: spacing.lg,
    textAlign:    'center',
  },
  grid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'space-between',
    gap:            spacing.sm,
  },
  pillar: {
    width:           '47%',
    backgroundColor: colors.surface,
    borderRadius:    radii.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.borderSubtle,
    alignItems:      'center',
  },
  icon: {
    fontSize:     24,
    marginBottom: spacing.xs,
  },
  pillarTitle: {
    fontFamily:   typography.headingMid.family,
    fontSize:     14,
    color:        colors.ink,
    textAlign:    'center',
    marginBottom: 4,
  },
  pillarDesc: {
    fontFamily: typography.body.family,
    fontSize:   12,
    color:      colors.inkMute,
    textAlign:  'center',
    lineHeight: 18,
  },
});
