// apps/customer-mobile/app/profile/delete-account-done.tsx
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';

export default function DeleteAccountDoneScreen(): React.ReactElement {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl }}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: typography.display.family, fontSize: 26, color: colors.ink, marginBottom: spacing.md, textAlign: 'center' }}
        >
          आपका खाता मिटा दिया गया है
        </Text>
        <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.inkMute, lineHeight: 22, textAlign: 'center' }}>
          आपकी व्यक्तिगत जानकारी हमारे सिस्टम से हटा दी गई है। 30 दिनों के बाद कोई भी अवशेष पंक्तियाँ स्थायी रूप से हटा दी जाएँगी।
          धन्यवाद।
        </Text>
      </ScrollView>
    </View>
  );
}
