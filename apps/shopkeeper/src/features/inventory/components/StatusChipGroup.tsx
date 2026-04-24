import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';

export type ProductStatus =
  | 'IN_STOCK'
  | 'SOLD'
  | 'RESERVED'
  | 'ON_APPROVAL'
  | 'WITH_KARIGAR';

const ALL_STATUSES: ProductStatus[] = [
  'IN_STOCK', 'RESERVED', 'ON_APPROVAL', 'WITH_KARIGAR', 'SOLD',
];

const STATUS_LABEL: Record<ProductStatus, string> = {
  IN_STOCK:     'स्टॉक में',
  SOLD:         'बिक गया',
  RESERVED:     'रिज़र्व',
  ON_APPROVAL:  'अप्रूवल पर',
  WITH_KARIGAR: 'कारीगर के पास',
};

const VALID_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  IN_STOCK:     ['RESERVED', 'ON_APPROVAL', 'WITH_KARIGAR', 'SOLD'],
  RESERVED:     ['IN_STOCK', 'ON_APPROVAL', 'SOLD'],
  ON_APPROVAL:  ['IN_STOCK', 'RESERVED', 'SOLD'],
  WITH_KARIGAR: ['IN_STOCK'],
  SOLD:         [],
};

interface StatusChipGroupProps {
  currentStatus: ProductStatus;
  onSelect: (status: ProductStatus) => void;
  disabled?: boolean;
}

export function StatusChipGroup({
  currentStatus,
  onSelect,
  disabled = false,
}: StatusChipGroupProps): React.ReactElement {
  const validTargets = VALID_TRANSITIONS[currentStatus];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup"
    >
      {ALL_STATUSES.map((status) => {
        const isCurrent = status === currentStatus;
        const isSelectable = !isCurrent && validTargets.includes(status) && !disabled;
        const isDisabled = !isCurrent && !validTargets.includes(status);

        return (
          <Pressable
            key={status}
            style={[
              styles.chip,
              isCurrent && styles.chipCurrent,
              isDisabled && styles.chipDisabled,
            ]}
            onPress={isSelectable ? () => onSelect(status) : undefined}
            disabled={!isSelectable}
            accessibilityRole="radio"
            accessibilityState={{ selected: isCurrent, disabled: !isSelectable }}
            accessibilityLabel={STATUS_LABEL[status]}
          >
            <Text
              style={[
                styles.chipText,
                isCurrent && styles.chipTextCurrent,
                isDisabled && styles.chipTextDisabled,
              ]}
            >
              {STATUS_LABEL[status]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    minHeight: 48,
    minWidth: 80,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.background,
  },
  chipCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  chipDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.background,
    opacity: 0.4,
  },
  chipText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
  chipTextCurrent: {
    color: colors.primary,
    fontWeight: '600',
  },
  chipTextDisabled: {
    color: colors.textSecondary,
  },
});
