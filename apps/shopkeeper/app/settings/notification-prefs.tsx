import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
// eslint-disable-next-line import/no-unresolved -- expo-haptics is a native Expo module, not in node_modules; mocked in test via vitest alias; declared in expo-env.d.ts for tsc
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '@goldsmith/ui-tokens';
import { SettingsGroupCard } from '@goldsmith/ui-mobile';
import { t } from '@goldsmith/i18n';
import { NOTIFICATION_PREFS_DEFAULTS } from '@goldsmith/shared';
import type { NotificationPrefsConfig } from '@goldsmith/shared';
import { NotificationPrefRow } from '../../src/features/settings/components/NotificationPrefRow';
import { api } from '../../src/api/client';

type ChannelUpdate = { push?: boolean; sms?: boolean };
interface NotificationPrefsResponse extends NotificationPrefsConfig {
  etag: string;
}

export default function NotificationPrefsScreen(): React.ReactElement {
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<NotificationPrefsConfig>(NOTIFICATION_PREFS_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const { data, isLoading } = useQuery<NotificationPrefsResponse>({
    queryKey: ['settings', 'notification-prefs'],
    queryFn: async () => {
      const response = await api.get('/api/v1/settings/notification-prefs');
      return response.data as NotificationPrefsResponse;
    },
  });

  useEffect(() => {
    if (data) {
      const { etag: _etag, ...config } = data;
      setPrefs(config);
    }
  }, [data]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const mutation = useMutation({
    mutationFn: async (patch: Record<string, ChannelUpdate>) => {
      const response = await api.patch('/api/v1/settings/notification-prefs', patch);
      return response.data as NotificationPrefsResponse;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings', 'notification-prefs'], updated);
    },
  });

  async function handleChange(key: keyof NotificationPrefsConfig, channels: ChannelUpdate): Promise<void> {
    setPrefs((prev) => ({ ...prev, [key]: { ...(prev[key] as ChannelUpdate), ...channels } }));
    if (!mountedRef.current) return;
    setSaving(true);
    setError(null);
    try {
      await new Promise<void>((resolve, reject) => {
        mutation.mutate({ [key]: channels }, { onSuccess: () => resolve(), onError: (err) => reject(err) });
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
      if (mountedRef.current) setError(t('settings.notification_prefs.errors.save_failed'));
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
    <ScrollView style={styles.container}>
      <SettingsGroupCard title={t('settings.notification_prefs.title')}>
        <NotificationPrefRow
          label={t('settings.notification_prefs.rows.orderUpdates')}
          channels={prefs.orderUpdates}
          disabled={saving}
          onChange={(ch) => void handleChange('orderUpdates', ch)}
        />
        <NotificationPrefRow
          label={t('settings.notification_prefs.rows.loyaltyUpdates')}
          channels={prefs.loyaltyUpdates}
          disabled={saving}
          onChange={(ch) => void handleChange('loyaltyUpdates', ch)}
        />
        <NotificationPrefRow
          label={t('settings.notification_prefs.rows.rateAlerts')}
          channels={prefs.rateAlerts}
          disabled={saving}
          onChange={(ch) => void handleChange('rateAlerts', ch)}
        />
        <NotificationPrefRow
          label={t('settings.notification_prefs.rows.staffActivity')}
          channels={prefs.staffActivity}
          disabled={saving}
          onChange={(ch) => void handleChange('staffActivity', ch)}
        />
        <NotificationPrefRow
          label={t('settings.notification_prefs.rows.paymentReceipts')}
          channels={prefs.paymentReceipts}
          disabled={saving}
          onChange={(ch) => void handleChange('paymentReceipts', ch)}
        />
        <View style={styles.statusContainer}>
          {showSuccess && (
            <Text testID="notification-prefs-success" style={styles.success}>
              {t('settings.notification_prefs.save_success')}
            </Text>
          )}
          {error !== null && (
            <Text testID="notification-prefs-error" style={styles.error}>
              {error}
            </Text>
          )}
        </View>
      </SettingsGroupCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.bg, paddingTop: 16 },
  centered:        { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  statusContainer: { paddingHorizontal: 16, paddingVertical: 8 },
  success:         { color: '#2E7D32', fontSize: 14 },
  error:           { color: '#B1402B', fontSize: 14 },
});
