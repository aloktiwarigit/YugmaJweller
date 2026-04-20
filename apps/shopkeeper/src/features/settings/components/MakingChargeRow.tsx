import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { t } from '@goldsmith/i18n';
import type { MakingChargeConfig } from '@goldsmith/shared';

interface Props {
  config: MakingChargeConfig;
  onChange: (c: MakingChargeConfig) => void;
}

function validate(value: string, type: MakingChargeConfig['type']): string | null {
  const n = parseFloat(value);
  if (!value || isNaN(n) || n <= 0) {
    return t('settings.making_charges.errors.VALUE_POSITIVE_REQUIRED');
  }
  if (type === 'percent' && n > 100) {
    return t('settings.making_charges.errors.PERCENT_MAX_100');
  }
  return null;
}

export function MakingChargeRow({ config, onChange }: Props): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(config.value);
  const label = t(`settings.making_charges.categories.${config.category}`);
  const labelPercent = t('settings.making_charges.type_percent');
  const labelFixed = t('settings.making_charges.type_fixed');

  // Sync local input when config.value changes from parent (e.g. after API load or save)
  useEffect(() => {
    setInputValue(config.value);
  }, [config.value]);

  function handleTypeToggle(newType: MakingChargeConfig['type']): void {
    setError(validate(inputValue, newType)); // recompute error for new type
    onChange({ ...config, type: newType });
  }

  function handleValueChange(v: string): void {
    setInputValue(v);
    onChange({ ...config, value: v });
  }

  function handleBlur(): void {
    setError(validate(inputValue, config.type));
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Pressable
          testID="toggle-percent"
          onPress={() => handleTypeToggle('percent')}
          accessibilityRole="button"
          accessibilityState={{ selected: config.type === 'percent' }}
          style={[styles.toggle, config.type === 'percent' && styles.toggleActive]}
        >
          <Text>{labelPercent}</Text>
        </Pressable>
        <Pressable
          testID="toggle-fixed"
          onPress={() => handleTypeToggle('fixed_per_gram')}
          accessibilityRole="button"
          accessibilityState={{ selected: config.type === 'fixed_per_gram' }}
          style={[styles.toggle, config.type === 'fixed_per_gram' && styles.toggleActive]}
        >
          <Text>{labelFixed}</Text>
        </Pressable>
        <TextInput
          testID="value-input"
          value={inputValue}
          onChangeText={handleValueChange}
          onBlur={handleBlur}
          keyboardType="decimal-pad"
          style={styles.input}
        />
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggle: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#999',
  },
  toggleActive: {
    borderColor: '#B8860B',
    backgroundColor: '#FFF8E1',
  },
  input: {
    minHeight: 48,
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    paddingHorizontal: 8,
    fontSize: 16,
  },
  error: {
    color: '#B1402B',
    fontSize: 14,
    marginTop: 4,
  },
});
