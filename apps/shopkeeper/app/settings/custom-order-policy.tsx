import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
// eslint-disable-next-line import/no-unresolved -- expo-haptics is a native Expo module, not in node_modules; mocked in test via vitest alias; declared in expo-env.d.ts for tsc
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '@goldsmith/ui-tokens';
import { SettingsGroupCard } from '@goldsmith/ui-mobile';
import { t } from '@goldsmith/i18n';
import { api } from '../../src/api/client';

interface CustomOrderPolicyResponse {
  customOrderPolicyText: string | null;
  etag: string;
}

const MAX_CHARS = 2000;

export default function CustomOrderPolicyScreen(): React.ReactElement {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const { data, isLoading } = useQuery<CustomOrderPolicyResponse>({
    queryKey: ['settings', 'custom-order-policy'],
    queryFn: async () => {
      const response = await api.get('/api/v1/settings/custom-order-policy');
      return response.data as CustomOrderPolicyResponse;
    },
  });

  useEffect(() => {
    if (data) setText(data.customOrderPolicyText ?? '');
  }, [data]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const mutation = useMutation({
    mutationFn: async (policyText: string) => {
      const response = await api.patch('/api/v1/settings/custom-order-policy', {
        customOrderPolicyText: policyText,
      });
      return response.data as CustomOrderPolicyResponse;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings', 'custom-order-policy'], updated);
    },
  });

  async function handleBlur(): Promise<void> {
    if (!mountedRef.current) return;
    setSaving(true);
    setError(null);
    try {
      await new Promise<void>((resolve, reject) => {
        mutation.mutate(text, { onSuccess: () => resolve(), onError: (err) => reject(err) });
      });
      if (!mountedRef.current) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!mountedRef.current) return;
      setShowSuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setShowSuccess(false);
      }, 2000);
    } catch {
      if (mountedRef.current) setError(t('settings.custom_order_policy.errors.save_failed'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SettingsGroupCard title={t('settings.custom_order_policy.title')}>
        <View style={styles.inner}>
          <TextInput
            testID="custom-order-policy-input"
            multiline
            value={text}
            onChangeText={setText}
            onBlur={() => void handleBlur()}
            placeholder={t('settings.custom_order_policy.placeholder')}
            maxLength={MAX_CHARS}
            editable={!saving}
            style={styles.input}
            accessibilityLabel={t('settings.custom_order_policy.title')}
          />
          <Text style={styles.counter} testID="custom-order-policy-counter">
            {text.length}/{MAX_CHARS}
          </Text>
          {showSuccess && (
            <Text testID="custom-order-policy-success" style={styles.success}>
              {t('settings.custom_order_policy.save_success')}
            </Text>
          )}
          {error !== null && (
            <Text testID="custom-order-policy-error" style={styles.error}>{error}</Text>
          )}
        </View>
      </SettingsGroupCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  inner: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  input: {
    minHeight: 120,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    color: '#1a1a1a',
  },
  counter: { fontSize: 12, color: '#888', textAlign: 'right' },
  success: { color: '#2E7D32', fontSize: 14 },
  error: { color: '#B1402B', fontSize: 14 },
});
