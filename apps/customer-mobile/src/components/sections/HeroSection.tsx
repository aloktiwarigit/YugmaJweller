import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { router } from 'expo-router';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { useTenantStore } from '../../stores/tenantStore';
import { storefrontHeroImage } from '../../assets/storefrontImages';

export function HeroSection(): React.ReactElement {
  const tenant = useTenantStore((s) => s.tenant);
  const shopName = tenant?.branding?.appName ?? tenant?.displayName ?? 'आपकी दुकान';

  return (
    <ImageBackground
        source={storefrontHeroImage}
        resizeMode="cover"
        imageStyle={styles.heroImage}
        style={styles.container}
      >
      <View style={styles.scrim} />

      {/* Shop name eyebrow */}
      <Text style={styles.eyebrow}>{shopName}</Text>

      {/* Display headline */}
      <Text style={styles.headline}>आपके लिए बेहतरीन{'\n'}आभूषण</Text>

      {/* Subline */}
      <Text style={styles.subline}>
        BIS हॉलमार्क · पारदर्शी मूल्य · विश्वसनीय सेवा
      </Text>

      {/* CTA row */}
      <View style={styles.ctaRow}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/browse')}
          style={styles.ctaPrimary}
          accessibilityRole="button"
          accessibilityLabel="उत्पाद देखें"
        >
          <Text style={styles.ctaPrimaryText}>उत्पाद देखें</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/try-at-home' as Parameters<typeof router.push>[0])}
          style={styles.ctaSecondary}
          accessibilityRole="button"
          accessibilityLabel="घर पर ट्राय करें"
        >
          <Text style={styles.ctaSecondaryText}>घर पर ट्राय करें</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop:        spacing.md,
    borderRadius:     radii.lg,
    padding:          spacing.lg,
    minHeight:        280,
    justifyContent:   'flex-end',
    overflow:         'hidden',
    backgroundColor:  colors.ink,
  },
  heroImage: {
    borderRadius: radii.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 36, 64, 0.42)',
  },
  eyebrow: {
    fontFamily:    typography.body.family,
    fontSize:      12,
    color:         'rgba(255,255,255,0.82)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  spacing.xs,
  },
  headline: {
    fontFamily:   typography.display.family,
    fontSize:     30,
    lineHeight:   36,
    color:        colors.white,
    marginBottom: spacing.sm,
  },
  subline: {
    fontFamily:   typography.body.family,
    fontSize:     13,
    color:        'rgba(255,255,255,0.82)',
    marginBottom: spacing.lg,
    lineHeight:   20,
  },
  ctaRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  ctaPrimary: {
    flex:             1,
    backgroundColor:  colors.primaryWash,
    borderRadius:     radii.md,
    paddingVertical:  12,
    alignItems:       'center',
    minHeight:        48,
    justifyContent:   'center',
  },
  ctaPrimaryText: {
    fontFamily: typography.headingMid.family,
    fontSize:   15,
    color:      colors.ink,
  },
  ctaSecondary: {
    flex:            1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius:    radii.md,
    paddingVertical: 12,
    alignItems:      'center',
    minHeight:       48,
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.42)',
  },
  ctaSecondaryText: {
    fontFamily: typography.headingMid.family,
    fontSize:   15,
    color:      colors.white,
  },
});
