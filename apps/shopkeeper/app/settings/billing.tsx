import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@goldsmith/ui-tokens';

export default function BillingScreen(): React.ReactElement {
  return (
    <View style={styles.container} testID="billing-screen">
      <Text style={styles.text}>बिलिंग — जल्द आ रहा है</Text>
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
