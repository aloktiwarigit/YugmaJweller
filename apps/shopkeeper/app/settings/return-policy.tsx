import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
// eslint-disable-next-line import/no-unresolved -- expo-haptics is a native Expo module, not in node_modules; mocked in test via vitest alias; declared in expo-env.d.ts for tsc
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '@goldsmith/ui-tokens';
import { SettingsGroupCard } from '@goldsmith/ui-mobile';
import { t } from '@goldsmith/i18n';
import { api } from '../../src/api/client';

interface ReturnPolicyResponse {
  returnPolicyText: string | null;
  etag: string;
}

const MAX_CHARS = 2000;

export default function ReturnPolicyScreen(): React.ReactElement {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const { data, isLoading } = useQuery<ReturnPolicyResponse>({
    queryKey: ['settings', 'return-policy'],
    queryFn: async () => {
      const response = await api.get('/api/v1/settings/return-policy');
      return response.data as ReturnPolicyResponse;
    },
  });

  useEffect(() => {
    if (data) setText(data.returnPolicyText ?? '');
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
      const response = await api.patch('/api/v1/settings/return-policy', {
        returnPolicyText: policyText,
      });
      return response.data as ReturnPolicyResponse;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings', 'return-policy'], updated);
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
      if (mountedRef.current) setError(t('settings.return_policy.errors.save_failed'));
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
      <SettingsGroupCard title={t('settings.return_policy.title')}>
        <View style={styles.inner}>
          <TextInput
            testID="return-policy-input"
            multiline
            value={text}
            onChangeText={setText}
            onBlur={() => void handleBlur()}
            placeholder={t('settings.return_policy.placeholder')}
            maxLength={MAX_CHARS}
            editable={!saving}
            style={styles.input}
            accessibilityLabel={t('settings.return_policy.title')}
          />
          <Text style={styles.counter} testID="return-policy-counter">
            {text.length}/{MAX_CHARS}
          </Text>
          {showSuccess && (
            <Text testID="return-policy-success" style={styles.success}>
              {t('settings.return_policy.save_success')}
            </Text>
          )}
          {error !== null && (
            <Text testID="return-policy-error" style={styles.error}>{error}</Text>
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
