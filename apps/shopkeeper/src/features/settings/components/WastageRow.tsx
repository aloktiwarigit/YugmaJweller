import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { t } from '@goldsmith/i18n';

interface Props {
  percent: string;
  label: string;
  onSave: (percent: string) => Promise<void>;
}

const DECIMAL_RE = /^\d+(\.\d+)?$/;

function validate(value: string): string | null {
  if (!value || !DECIMAL_RE.test(value)) {
    return t('settings.wastage.errors.VALUE_FORMAT_INVALID');
  }
  const num = parseFloat(value);
  if (num <= 0) {
    return t('settings.wastage.errors.VALUE_POSITIVE_REQUIRED');
  }
  if (num > 30) {
    return t('settings.wastage.errors.wastage_high');
  }
  return null;
}

export function WastageRow({ percent, label, onSave }: Props): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(percent);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync local input when percent changes from parent
  useEffect(() => {
    setInputValue(percent);
  }, [percent]);

  function handleBlur(): void {
    setError(validate(inputValue));
  }

  async function handleSave(): Promise<void> {
    const trimmed = inputValue.trim();
    const validationError = validate(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmed);
      setError(null);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <TextInput
          testID="percent-input"
          value={inputValue}
          onChangeText={setInputValue}
          onBlur={handleBlur}
          keyboardType="decimal-pad"
          placeholder="0.00"
          style={styles.input}
          editable={!isSaving}
        />
        <Pressable
          testID="save-btn"
          onPress={() => void handleSave()}
          disabled={isSaving}
          accessibilityRole="button"
          style={styles.saveBtn}
        >
          <Text style={styles.saveBtnText}>{t('common.save')}</Text>
        </Pressable>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {showSuccess && (
        <Text style={styles.success}>{t('settings.wastage.save_success')}</Text>
      )}
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
  input: {
    minHeight: 48,
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    paddingHorizontal: 8,
    fontSize: 16,
  },
  saveBtn: {
    minHeight: 48,
    minWidth: 72,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#B8860B',
    backgroundColor: '#FFF8E1',
  },
  saveBtnText: {
    fontSize: 16,
    color: '#7A5400',
  },
  error: {
    color: '#B1402B',
    fontSize: 14,
    marginTop: 4,
  },
  success: {
    color: '#2E7D32',
    fontSize: 14,
    marginTop: 4,
  },
});
