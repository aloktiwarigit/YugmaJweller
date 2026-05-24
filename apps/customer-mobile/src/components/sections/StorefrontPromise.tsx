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
    icon:    '✓',
    titleHi: 'BIS / HUID',
    descHi:  'योग्य उत्पाद पर प्रमाणित हॉलमार्क',
  },
  {
    icon:    '₹',
    titleHi: 'मूल्य ब्रेकअप',
    descHi:  'धातु, बनाई और GST अलग-अलग',
  },
  {
    icon:    '↺',
    titleHi: 'एक्सचेंज मार्गदर्शन',
    descHi:  'दुकान की नीति साफ़ दिखेगी',
  },
  {
    icon:    '⌂',
    titleHi: 'घर पर ट्राय',
    descHi:  'चुने हुए डिज़ाइन घर पर देखें',
  },
  {
    icon:    '⌖',
    titleHi: 'स्टोर उपलब्धता',
    descHi:  'दुकान से डिज़ाइन की पुष्टि',
  },
  {
    icon:    '✆',
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
    fontSize:     22,
    color:        colors.primaryDeep,
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
