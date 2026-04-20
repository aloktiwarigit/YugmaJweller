import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@goldsmith/ui-tokens';

export default function ReportsScreen(): React.ReactElement {
  return (
    <View style={styles.container} testID="reports-screen">
      <Text style={styles.text}>रिपोर्ट्स — जल्द आ रहा है</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    fontFamily: typography.body.family,
    color: colors.inkMute,
  },
});
