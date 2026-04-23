import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Switch, Pressable, StyleSheet } from 'react-native';
// eslint-disable-next-line import/no-unresolved -- expo-haptics is a native Expo module, not in node_modules; mocked in test via vitest alias; declared in expo-env.d.ts for tsc
import * as Haptics from 'expo-haptics';
import { SettingsGroupCard } from '@goldsmith/ui-mobile';
import { t } from '@goldsmith/i18n';

interface Props {
  enabled: boolean;
  maxPieces: number;
  onSave: (patch: { tryAtHomeEnabled?: boolean; tryAtHomeMaxPieces?: number }) => Promise<void>;
}

const MIN_PIECES = 1;
const MAX_PIECES = 10;

export function TryAtHomeToggle({ enabled, maxPieces, onSave }: Props): React.ReactElement {
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [localMaxPieces, setLocalMaxPieces] = useState(maxPieces);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  const mountedRef = useRef(true);

  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  useEffect(() => {
    setLocalEnabled(enabled);
    setLocalMaxPieces(maxPieces);
  }, [enabled, maxPieces]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  function handleToggle(value: boolean): void {
    setLocalEnabled(value);
    setError(null);
    void save({ tryAtHomeEnabled: value });
  }

  function handleStep(delta: number): void {
    const next = localMaxPieces + delta;
    if (next < MIN_PIECES || next > MAX_PIECES) return;
    setLocalMaxPieces(next);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save({ tryAtHomeMaxPieces: next }), 1000);
  }

  async function save(patch: { tryAtHomeEnabled?: boolean; tryAtHomeMaxPieces?: number }): Promise<void> {
    if (!mountedRef.current) return;
    setSaving(true);
    try {
      await onSaveRef.current(patch);
      if (!mountedRef.current) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!mountedRef.current) return;
      setShowSuccess(true);
      setError(null);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setShowSuccess(false);
      }, 2000);
    } catch {
      if (!mountedRef.current) return;
      setError('बदलाव नहीं हो सका। दोबारा कोशिश करें।');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <SettingsGroupCard title={t('settings.try_at_home.title')}>
      <View style={styles.inner}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabels}>
            <Text style={styles.label}>{t('settings.try_at_home.title')}</Text>
            <Text style={styles.description}>{t('settings.try_at_home.description')}</Text>
          </View>
          <Switch
            testID="try-at-home-toggle"
            value={localEnabled}
            onValueChange={handleToggle}
            disabled={saving}
            trackColor={{ true: '#B8860B', false: '#ccc' }}
            thumbColor="#fff"
            accessibilityLabel={t('settings.try_at_home.title')}
          />
        </View>

        <View style={[styles.stepperSection, !localEnabled && styles.sectionDisabled]}>
          <Text style={[styles.label, !localEnabled && styles.textDisabled]}>
            {t('settings.try_at_home.max_pieces_label')}
          </Text>
          <View style={styles.stepper}>
            <Pressable
              testID="try-at-home-decrement"
              onPress={() => handleStep(-1)}
              disabled={saving || !localEnabled}
              style={[styles.stepBtn, (!localEnabled || saving) && styles.stepBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="कम करें"
            >
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>

            <Text
              testID="try-at-home-value"
              style={[styles.valueText, !localEnabled && styles.textDisabled]}
            >
              {localMaxPieces}
            </Text>

            <Pressable
              testID="try-at-home-increment"
              onPress={() => handleStep(1)}
              disabled={saving || !localEnabled}
              style={[styles.stepBtn, (!localEnabled || saving) && styles.stepBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="बढ़ाएं"
            >
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        {showSuccess && (
          <Text testID="try-at-home-success" style={styles.success}>
            {t('settings.try_at_home.save_success')}
          </Text>
        )}
        {error !== null && (
          <Text testID="try-at-home-error" style={styles.error}>{error}</Text>
        )}
      </View>
    </SettingsGroupCard>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabels: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
  stepperSection: {
    gap: 8,
  },
  sectionDisabled: {
    opacity: 0.4,
  },
  textDisabled: {
    color: '#aaa',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepBtn: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B8860B',
    backgroundColor: '#FFF8E1',
  },
  stepBtnDisabled: {
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  stepBtnText: {
    fontSize: 24,
    color: '#7A5400',
    fontWeight: '600',
  },
  valueText: {
    fontSize: 24,
    fontWeight: '700',
    minWidth: 48,
    textAlign: 'center',
  },
  success: {
    color: '#2E7D32',
    fontSize: 14,
  },
  error: {
    color: '#B1402B',
    fontSize: 14,
  },
});
