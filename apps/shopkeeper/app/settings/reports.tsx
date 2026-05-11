import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';

export default function ReportsSettingsScreen(): React.ReactElement {
  return (
    <View style={styles.container} testID="reports-settings-screen">
      <Ionicons name="bar-chart-outline" size={48} color={colors.inkMute} />
      <Text style={styles.title}>रिपोर्ट सेटिंग्स</Text>
      <Text style={styles.body}>यह जल्द उपलब्ध होगा।</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontFamily: typography.headingMid.family,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  body: {
    fontSize: 16,
    fontFamily: typography.body.family,
    color: colors.inkMute,
    textAlign: 'center',
  },
});
