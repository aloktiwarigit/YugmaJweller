import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { SettingsGroupCard } from '@goldsmith/ui-mobile';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
// Permission keys mirrored from @goldsmith/shared — kept in sync manually.
// Source of truth: packages/shared/src/schemas/role-permissions.schema.ts
const PERMISSION_KEYS: readonly string[] = [
  'billing.create',
  'billing.void',
  'inventory.edit',
  'settings.edit',
  'reports.view',
  'analytics.view',
] as const;

const PERMISSION_HINDI_LABELS: Record<string, string> = {
  'billing.create': 'बिल बनाएं',
  'billing.void': 'बिल रद्द करें',
  'inventory.edit': 'इन्वेंटरी संपादित करें',
  'settings.edit': 'सेटिंग्स बदलें',
  'reports.view': 'रिपोर्ट देखें',
  'analytics.view': 'एनालिटिक्स देखें',
};

export interface PermissionsMatrixProps {
  role: 'shop_manager' | 'shop_staff';
  permissions: Record<string, boolean>;
  onToggle: (key: string, value: boolean) => void;
  loading?: boolean;
}

export function PermissionsMatrix({
  permissions,
  onToggle,
  loading = false,
}: PermissionsMatrixProps): React.ReactElement {
  return (
    <SettingsGroupCard title="अनुमतियाँ">
      {(PERMISSION_KEYS as readonly string[]).map((key: string, index: number) => {
        const isEnabled = permissions[key] === true;
        const isLast = index === PERMISSION_KEYS.length - 1;
        const label = PERMISSION_HINDI_LABELS[key] ?? key;

        return (
          <View
            key={key}
            style={[styles.row, !isLast && styles.rowBorder]}
          >
            <Text style={styles.permLabel}>{label}</Text>
            <Switch
              testID={`perm-toggle-${key}`}
              value={isEnabled}
              onValueChange={(value) => onToggle(key, value)}
              disabled={loading}
              thumbColor={isEnabled ? colors.primary : '#CCCCCC'}
              trackColor={{
                false: colors.border,
                true: '#DFC99E',
              }}
              accessibilityLabel={label}
              accessibilityRole="switch"
              accessibilityState={{ checked: isEnabled, disabled: loading }}
            />
          </View>
        );
      })}
    </SettingsGroupCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  permLabel: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.ink,
    flex: 1,
    paddingRight: spacing.sm,
  },
});
