import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { t } from '@goldsmith/i18n';

interface Channels {
  push?: boolean;
  sms?: boolean;
}

interface Props {
  label: string;
  channels: Channels;
  disabled?: boolean;
  onChange: (channels: Channels) => void;
}

export function NotificationPrefRow({ label, channels, disabled = false, onChange }: Props): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.togglesContainer}>
        <View style={styles.toggleItem}>
          <Text style={styles.channelLabel}>{t('settings.notification_prefs.channels.push')}</Text>
          <Switch
            value={channels.push ?? false}
            onValueChange={(v) => onChange({ ...channels, push: v })}
            disabled={disabled}
            trackColor={{ true: '#B8860B', false: '#ccc' }}
            thumbColor="#fff"
            accessibilityLabel={`${label} — ${t('settings.notification_prefs.channels.push')}`}
          />
        </View>
        {channels.sms !== undefined && (
          <View style={styles.toggleItem}>
            <Text style={styles.channelLabel}>{t('settings.notification_prefs.channels.sms')}</Text>
            <Switch
              value={channels.sms}
              onValueChange={(v) => onChange({ ...channels, sms: v })}
              disabled={disabled}
              trackColor={{ true: '#B8860B', false: '#ccc' }}
              thumbColor="#fff"
              accessibilityLabel={`${label} — ${t('settings.notification_prefs.channels.sms')}`}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  label:            { fontSize: 16, fontWeight: '500', marginBottom: 8 },
  togglesContainer: { flexDirection: 'row', gap: 24 },
  toggleItem:       { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  channelLabel:     { fontSize: 14, color: '#555' },
});
