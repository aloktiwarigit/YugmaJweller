import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { t } from '@goldsmith/i18n';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { LOCALE_OPTIONS, useLocaleStore, type AppLocale } from '../../src/stores/localeStore';
import { updateAppLocale } from '../../src/providers/LocaleProvider';

interface SettingsItem {
  key: string;
  labelKey: string;
  route: string;
  devOnly?: boolean;
}

const items: readonly SettingsItem[] = [
  { key: 'account', labelKey: 'settings.menu.account', route: '/settings/account' },
  { key: 'shop_profile', labelKey: 'settings.menu.shop_profile', route: '/settings/shop-profile' },
  { key: 'staff', labelKey: 'settings.menu.staff', route: '/settings/staff' },
  { key: 'making_charges', labelKey: 'settings.menu.making_charges', route: '/settings/making-charges' },
  { key: 'wastage', labelKey: 'settings.menu.wastage', route: '/settings/wastage' },
  { key: 'rate_lock', labelKey: 'settings.menu.rate_lock', route: '/settings/rate-lock' },
  { key: 'try_at_home', labelKey: 'settings.menu.try_at_home', route: '/settings/try-at-home' },
  { key: 'custom_order_policy', labelKey: 'settings.menu.custom_order_policy', route: '/settings/custom-order-policy' },
  { key: 'return_policy', labelKey: 'settings.menu.return_policy', route: '/settings/return-policy' },
  { key: 'notification_prefs', labelKey: 'settings.menu.notification_prefs', route: '/settings/notification-prefs' },
  { key: 'loyalty', labelKey: 'settings.menu.loyalty', route: '/settings/loyalty' },
  { key: 'billing', labelKey: 'settings.menu.billing', route: '/settings/billing' },
  { key: 'reports', labelKey: 'settings.menu.reports', route: '/settings/reports' },
  { key: 'audit_log', labelKey: 'settings.menu.audit_log', route: '/settings/audit-log' },
  { key: 'theme', labelKey: 'settings.menu.theme', route: '/settings/theme', devOnly: true },
];

function localeLabelKey(locale: AppLocale): string {
  return locale === 'hi-IN' ? 'settings.language.hi' : 'settings.language.en';
}

export default function SettingsScreen(): React.ReactElement {
  const locale = useLocaleStore((s) => s.locale);
  const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;
  const visible = items.filter((item) => !item.devOnly || isDevBuild);

  const onSelectLocale = (nextLocale: AppLocale): void => {
    if (nextLocale === locale) return;
    void updateAppLocale(nextLocale);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('settings.title')}</Text>
      <View style={styles.languageCard}>
        <View style={styles.languageCopy}>
          <Text style={styles.languageTitle}>{t('settings.language.title')}</Text>
          <Text style={styles.languageSubtitle}>{t('settings.language.subtitle')}</Text>
        </View>
        <View style={styles.languageToggle}>
          {LOCALE_OPTIONS.map((option) => {
            const selected = option === locale;
            const label = t(localeLabelKey(option));
            return (
              <TouchableOpacity
                key={option}
                testID={`settings-language-${option}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                onPress={() => onSelectLocale(option)}
                style={[
                  styles.languageButton,
                  selected ? styles.languageButtonSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.languageButtonText,
                    selected ? styles.languageButtonTextSelected : null,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {visible.map((item) => {
        const label = t(item.labelKey);
        return (
          <TouchableOpacity
            key={item.key}
            testID={`settings-item-${item.key}`}
            style={styles.row}
            onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        );
      })}
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: typography.display.family,
    color: colors.ink,
    padding: spacing.md,
    paddingTop: spacing.xl,
  },
  languageCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 10,
    padding: spacing.md,
  },
  languageCopy: {
    marginBottom: spacing.sm,
  },
  languageTitle: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  languageSubtitle: {
    fontFamily: typography.body.family,
    fontSize: 13,
    color: colors.inkMute,
  },
  languageToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 4,
  },
  languageButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  languageButtonSelected: {
    backgroundColor: colors.primary,
  },
  languageButtonText: {
    fontFamily: typography.body.family,
    fontSize: 15,
    fontWeight: '700',
    color: colors.inkMute,
  },
  languageButtonTextSelected: {
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: typography.body.family,
    color: colors.ink,
  },
  arrow: {
    fontSize: 20,
    color: colors.inkMute,
  },
});
