import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';

export interface InventoryRowProps {
  id: string;
  sku: string;
  metal: string;
  purity: string;
  weightG: string;
  status: string;
  huid?: string | null;
  published?: boolean;
  onPress?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Status chip configuration
// ---------------------------------------------------------------------------

interface ChipConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
}

const STATUS_CHIP: Record<string, ChipConfig> = {
  IN_STOCK: {
    label: 'स्टॉक में',
    bg: '#E8F5E9',
    text: '#2E7D32',
    border: '#A5D6A7',
  },
  SOLD: {
    label: 'बिका',
    bg: '#F5F5F5',
    text: '#616161',
    border: '#BDBDBD',
  },
  ON_ORDER: {
    label: 'ऑर्डर पर',
    bg: '#FFF8E1',
    text: '#F57F17',
    border: '#FFD54F',
  },
  RESERVED: {
    label: 'आरक्षित',
    bg: '#EDE7F6',
    text: '#4527A0',
    border: '#B39DDB',
  },
  ON_APPROVAL: {
    label: 'स्वीकृति में',
    bg: '#FFF3E0',
    text: '#E65100',
    border: '#FFCC02',
  },
  WITH_KARIGAR: {
    label: 'कारीगर के पास',
    bg: '#E0F2F1',
    text: '#00695C',
    border: '#80CBC4',
  },
};

function getChipConfig(status: string): ChipConfig {
  return (
    STATUS_CHIP[status] ?? {
      label: status,
      bg: '#E3F2FD',
      text: '#1565C0',
      border: '#90CAF9',
    }
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InventoryRow({
  id,
  sku,
  metal,
  purity,
  weightG,
  status,
  huid,
  published,
  onPress,
}: InventoryRowProps): React.ReactElement {
  const chip = getChipConfig(status);
  const weightDisplay = `${parseFloat(weightG).toFixed(2)}g`;
  const hasHuid = huid != null && huid.length > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress ? () => onPress(id) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`उत्पाद ${sku}, ${metal} ${purity}, ${weightDisplay}`}
      accessibilityState={{ disabled: onPress === undefined }}
    >
      {/* Left: SKU + HUID badge + meta */}
      <View style={styles.left}>
        <View style={styles.skuRow}>
          <Text style={styles.sku} numberOfLines={1}>
            {sku}
          </Text>
          {hasHuid && (
            <View style={styles.huidBadge} accessibilityLabel={`HUID: ${huid}`}>
              <Text style={styles.huidText}>HUID</Text>
            </View>
          )}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {metal} · {purity} · {weightDisplay}
        </Text>
        {published === false && (
          <Text style={styles.unpublished}>अप्रकाशित</Text>
        )}
      </View>

      {/* Right: status chip */}
      <View
        style={[styles.chip, { backgroundColor: chip.bg, borderColor: chip.border }]}
        accessibilityLabel={`स्थिति: ${chip.label}`}
      >
        <Text style={[styles.chipText, { color: chip.text }]}>{chip.label}</Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.bg,
  },
  left: {
    flex: 1,
    gap: 4,
    marginRight: spacing.sm,
  },
  skuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs ?? 6,
    flexWrap: 'wrap',
  },
  sku: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  huidBadge: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  huidText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1565C0',
    letterSpacing: 0.5,
  },
  meta: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textSecondary,
  },
  unpublished: {
    fontFamily: typography.body.family,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  chipText: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
});
