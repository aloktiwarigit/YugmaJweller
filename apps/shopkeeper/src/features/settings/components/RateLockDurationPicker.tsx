import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
// eslint-disable-next-line import/no-unresolved -- expo-haptics is a native Expo module, not in node_modules; mocked in test via vitest alias; declared in expo-env.d.ts for tsc
import * as Haptics from 'expo-haptics';
import { SettingsGroupCard } from '@goldsmith/ui-mobile';
import { t } from '@goldsmith/i18n';

interface Props {
  days: number;
  onSave: (days: number) => Promise<void>;
}

const MIN = 1;
const MAX = 30;

export function RateLockDurationPicker({ days, onSave }: Props): React.ReactElement {
  const [localDays, setLocalDays] = useState(days);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  const mountedRef = useRef(true);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Keep onSaveRef in sync with latest prop
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  // Sync if parent value changes (e.g. query refetch)
  useEffect(() => {
    setLocalDays(days);
  }, [days]);

  // Cleanup debounce and success timer on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  function triggerShake(): void {
    shakeAnim.stopAnimation();
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleStep(delta: number): void {
    const next = localDays + delta;
    if (next < MIN || next > MAX) {
      triggerShake();
      return;
    }
    setLocalDays(next);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save(next), 1000);
  }

  async function save(d: number): Promise<void> {
    if (!mountedRef.current) return;
    setSaving(true);
    try {
      await onSaveRef.current(d);
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
      setError(t('settings.rate_lock.errors.RANGE_INVALID'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <SettingsGroupCard title={t('settings.rate_lock.title')}>
      <View style={styles.inner}>
        <Text style={styles.label}>{t('settings.rate_lock.label')}</Text>
        <Text style={styles.description}>{t('settings.rate_lock.description')}</Text>
        <Animated.View style={[styles.stepper, { transform: [{ translateX: shakeAnim }] }]}>
          <Pressable
            testID="rate-lock-decrement"
            onPress={() => handleStep(-1)}
            disabled={saving}
            style={styles.stepBtn}
            accessibilityRole="button"
            accessibilityLabel="कम करें"
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>

          <Text testID="rate-lock-value" style={styles.valueText}>{localDays}</Text>

          <Pressable
            testID="rate-lock-increment"
            onPress={() => handleStep(1)}
            disabled={saving}
            style={styles.stepBtn}
            accessibilityRole="button"
            accessibilityLabel="बढ़ाएं"
          >
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </Animated.View>

        {showSuccess && (
          <Text testID="rate-lock-success" style={styles.success}>
            {t('settings.rate_lock.save_success')}
          </Text>
        )}
        {error !== null && (
          <Text testID="rate-lock-error" style={styles.error}>{error}</Text>
        )}
      </View>
    </SettingsGroupCard>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
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
    marginTop: 8,
  },
  error: {
    color: '#B1402B',
    fontSize: 14,
    marginTop: 8,
  },
});
