import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface OfflineBadgeProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  onConflictPress?: () => void;
}

export function OfflineBadge({
  isOnline,
  isSyncing,
  pendingCount,
  conflictCount,
  onConflictPress,
}: OfflineBadgeProps): React.ReactElement | null {
  if (isOnline && !isSyncing && conflictCount === 0) return null;

  if (conflictCount > 0) {
    return (
      <TouchableOpacity
        style={[styles.banner, styles.conflict]}
        onPress={onConflictPress}
        accessibilityRole="button"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${conflictCount} टकराव — देखें`}
      >
        <Text style={styles.text}>{conflictCount} टकराव — देखें</Text>
      </TouchableOpacity>
    );
  }

  if (isSyncing) {
    return (
      <View style={[styles.banner, styles.syncing]} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color="#fff" style={styles.spinner} />
        <Text style={styles.text}>सिंक हो रहा है…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.offline]} accessibilityLiveRegion="polite">
      <Text style={styles.text}>
        {pendingCount > 0 ? `ऑफलाइन — ${pendingCount} बदलाव लंबित` : 'ऑफलाइन'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  offline: { backgroundColor: '#D97706' },  // amber-600
  syncing: { backgroundColor: '#0284C7' },  // sky-600
  conflict: { backgroundColor: '#DC2626' }, // red-600
  text: { color: '#fff', fontSize: 14, fontFamily: 'NotoSansDevanagari', fontWeight: '600' },
  spinner: { marginRight: 8 },
});
