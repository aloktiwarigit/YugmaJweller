import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';

type Category = 'rings' | 'bangles' | 'chains';

const RING_SIZES: Array<{ indian: number; circMm: number; diaM: number }> = [
  { indian: 1, circMm: 38.1, diaM: 12.1 }, { indian: 2, circMm: 39.5, diaM: 12.6 },
  { indian: 3, circMm: 40.8, diaM: 13.0 }, { indian: 4, circMm: 42.1, diaM: 13.4 },
  { indian: 5, circMm: 43.5, diaM: 13.8 }, { indian: 6, circMm: 44.8, diaM: 14.3 },
  { indian: 7, circMm: 46.2, diaM: 14.7 }, { indian: 8, circMm: 47.5, diaM: 15.1 },
  { indian: 9, circMm: 48.9, diaM: 15.6 }, { indian: 10, circMm: 50.2, diaM: 16.0 },
  { indian: 11, circMm: 51.5, diaM: 16.4 }, { indian: 12, circMm: 52.9, diaM: 16.8 },
  { indian: 13, circMm: 54.2, diaM: 17.3 }, { indian: 14, circMm: 55.6, diaM: 17.7 },
  { indian: 15, circMm: 56.9, diaM: 18.1 }, { indian: 16, circMm: 58.3, diaM: 18.5 },
  { indian: 17, circMm: 59.6, diaM: 19.0 }, { indian: 18, circMm: 60.9, diaM: 19.4 },
  { indian: 19, circMm: 62.3, diaM: 19.8 }, { indian: 20, circMm: 63.6, diaM: 20.2 },
];

const BANGLE_SIZES: Array<{ label: string; dia: number }> = [
  { label: 'XS', dia: 54 }, { label: 'S', dia: 56 },
  { label: 'M', dia: 58 },  { label: 'L', dia: 60 },
  { label: 'XL', dia: 62 }, { label: 'XXL', dia: 64 },
];

const CHAIN_SIZES: Array<{ inches: number; label: string }> = [
  { inches: 14, label: 'कॉलर' },   { inches: 16, label: 'चोकर' },
  { inches: 18, label: 'प्रिंसेस' }, { inches: 20, label: 'मेटिनी' },
  { inches: 22, label: 'ऑपेरा' },   { inches: 24, label: 'रोप (छोटा)' },
  { inches: 30, label: 'रोप (बड़ा)'}, { inches: 36, label: 'लॉन्ग रोप' },
];

const CATEGORIES: Array<{ key: Category; label: string }> = [
  { key: 'rings',   label: 'अंगूठी' },
  { key: 'bangles', label: 'चूड़ी' },
  { key: 'chains',  label: 'चेन' },
];

export default function SizeGuide(): React.ReactElement {
  const router = useRouter();
  const [active, setActive] = useState<Category>('rings');

  return (
    <View style={styles.root}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="वापस जाएं">
          <Text style={styles.backText}>← वापस</Text>
        </TouchableOpacity>

        <Text style={styles.title}>साइज़ गाइड</Text>

        {/* Category tabs */}
        <View style={styles.tabs}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              onPress={() => setActive(c.key)}
              style={[styles.tab, active === c.key && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active === c.key }}
            >
              <Text style={[styles.tabText, active === c.key && styles.tabTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rings */}
        {active === 'rings' && (
          <View>
            <Text style={styles.intro}>भारतीय साइज़ 1–20 (परिधि mm में)</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headerCell]}>साइज़</Text>
              <Text style={[styles.cell, styles.headerCell]}>परिधि (mm)</Text>
              <Text style={[styles.cell, styles.headerCell]}>व्यास (mm)</Text>
            </View>
            {RING_SIZES.map((r) => (
              <View key={r.indian} style={styles.row}>
                <Text style={[styles.cell, styles.boldCell]}>{r.indian}</Text>
                <Text style={styles.cell}>{r.circMm}</Text>
                <Text style={styles.cell}>{r.diaM}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bangles */}
        {active === 'bangles' && (
          <View>
            <Text style={styles.intro}>आंतरिक व्यास (mm) से साइज़ चुनें</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headerCell]}>साइज़</Text>
              <Text style={[styles.cell, styles.headerCell]}>व्यास (mm)</Text>
            </View>
            {BANGLE_SIZES.map((b) => (
              <View key={b.label} style={styles.row}>
                <Text style={[styles.cell, styles.boldCell]}>{b.label}</Text>
                <Text style={styles.cell}>{b.dia}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Chains */}
        {active === 'chains' && (
          <View>
            <Text style={styles.intro}>लंबाई इंच में — स्टाइल के हिसाब से चुनें</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headerCell]}>लंबाई (इंच)</Text>
              <Text style={[styles.cell, styles.headerCell]}>प्रकार</Text>
            </View>
            {CHAIN_SIZES.map((c) => (
              <View key={c.inches} style={styles.row}>
                <Text style={[styles.cell, styles.boldCell]}>{c.inches}"</Text>
                <Text style={styles.cell}>{c.label}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.bg },
  scroll:     { padding: 16, paddingBottom: 40 },
  backBtn:    { marginBottom: 16 },
  backText:   { fontFamily: typography.body.family, fontSize: 14, color: colors.primary },
  title:      { fontFamily: typography.serif.family, fontSize: 24, color: colors.ink, fontWeight: '700', marginBottom: 16 },
  intro:      { fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute, marginBottom: 10 },
  tabs:       { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab:        {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', backgroundColor: '#fff',
    minHeight: 44,
  },
  tabActive:      { borderColor: colors.primary, backgroundColor: colors.primary },
  tabText:        { fontFamily: typography.body.family, fontSize: 14, color: colors.ink },
  tabTextActive:  { fontFamily: typography.headingMid.family, color: '#fff', fontWeight: '600' },
  tableHeader:    { flexDirection: 'row', backgroundColor: colors.border, paddingVertical: 6 },
  row:            { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 6 },
  cell:           { fontFamily: typography.body.family, flex: 1, fontSize: 13, color: colors.ink, paddingHorizontal: 6 },
  headerCell:     { fontFamily: typography.headingMid.family, fontWeight: '700', color: colors.ink },
  boldCell:       { fontFamily: typography.headingMid.family, fontWeight: '600' },
});
