import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { THEME_PRESETS, spacing, typography, type ThemeId } from '@goldsmith/ui-tokens';
import { useThemeStore } from '../../src/stores/themeStore';
import { persistThemeId } from '../../src/providers/ThemeProvider';
import { useThemeTokens } from '../../src/hooks/useThemeTokens';

/**
 * Dev-only theme switcher (hidden from production builds).
 *
 * Demo flow: settings -> "थीम बदलें (Demo)" entry only visible when __DEV__,
 * tap a preset card -> live re-render across opted-in surfaces -> selection
 * persists across app reload via AsyncStorage.
 */
export default function ThemeSwitcherScreen(): React.ReactElement {
  const colors      = useThemeTokens();
  const activeId    = useThemeStore((s) => s.themeId);
  const setThemeId  = useThemeStore((s) => s.setThemeId);

  // Defence in depth — settings/index.tsx already gates the link by __DEV__.
  // If a release build somehow lands on this route (deep link, etc.) bail out.
  // Must be in useEffect to avoid calling router.replace during render.
  useEffect(() => {
    if (!__DEV__) {
      router.replace('/settings' as never);
    }
  }, []);

  if (!__DEV__) {
    return <View style={{ flex: 1, backgroundColor: '#F5EDDD' }} />;
  }

  const onSelect = (id: ThemeId): void => {
    setThemeId(id);
    void persistThemeId(id);
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.ink }]}>थीम बदलें</Text>
      <Text style={[styles.subtitle, { color: colors.inkMute }]}>
        Demo prop only — chosen theme persists across reload. Real per-tenant theming is
        deferred to Phase 4 customer-customization.
      </Text>

      <View style={styles.cardList}>
        {THEME_PRESETS.map((preset) => {
          const selected = preset.id === activeId;
          return (
            <Pressable
              key={preset.id}
              testID={`theme-preset-${preset.id}`}
              onPress={() => onSelect(preset.id)}
              accessibilityRole="button"
              accessibilityLabel={preset.displayName}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.white,
                  borderColor: selected ? preset.colors.primary : colors.border,
                  borderWidth: selected ? 2 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.swatchRow}>
                <View
                  style={[styles.swatch, { backgroundColor: preset.colors.primary }]}
                />
                <View
                  style={[styles.swatch, { backgroundColor: preset.colors.accent }]}
                />
                <View
                  style={[styles.swatch, { backgroundColor: preset.colors.bg }]}
                />
                <View
                  style={[styles.swatch, { backgroundColor: preset.colors.ink }]}
                />
              </View>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>
                {preset.displayName}
              </Text>
              <Text style={[styles.cardId, { color: colors.inkMute }]}>{preset.id}</Text>
              {selected && (
                <Text style={[styles.activeBadge, { color: preset.colors.primary }]}>
                  ✓ चयनित
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: typography.display.family,
    fontSize: 26,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.body.family,
    fontSize: 14,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  cardList: {
    gap: spacing.md,
  },
  card: {
    borderRadius: 12,
    padding: spacing.lg,
    minHeight: 120,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  cardTitle: {
    fontFamily: typography.body.family,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardId: {
    fontFamily: typography.body.family,
    fontSize: 13,
  },
  activeBadge: {
    fontFamily: typography.body.family,
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
});
