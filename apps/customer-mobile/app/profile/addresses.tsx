import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radii, spacing, typography } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';

export default function AddressBookScreen(): React.ReactElement {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
        <Pressable
          testID="address-book-back-button"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="प्रोफ़ाइल पर वापस जाएँ"
          style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: spacing.sm }}
        >
          <Text style={{ fontFamily: typography.body.family, color: colors.inkMute, fontSize: 14 }}>
            वापस
          </Text>
        </Pressable>

        <Text style={{ fontFamily: typography.display.family, fontSize: 24, color: colors.ink }}>
          पता पुस्तिका
        </Text>
        <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.inkMute, marginTop: spacing.xs }}>
          होम डिलीवरी और ट्राई-एट-होम बुकिंग के लिए आपका पसंदीदा पता।
        </Text>

        <View
          testID="address-book-backend-required"
          style={{
            backgroundColor: colors.white,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            marginTop: spacing.lg,
          }}
        >
          <Text style={{ fontFamily: typography.headingMid.family, fontSize: 17, color: colors.ink }}>
            अभी दुकान से पता पुष्टि होगी
          </Text>
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, marginTop: spacing.xs }}>
            ऐप में पता जोड़ना, बदलना और डिफ़ॉल्ट पता चुनना दुकान की सेवा जुड़ने के बाद चालू होगा।
          </Text>
        </View>

        <View style={{ marginTop: spacing.md }}>
          <InfoRow label="डिलीवरी" value="नाम, मोबाइल, पूरा पता, शहर, राज्य और पिन कोड चाहिए।" />
          <InfoRow label="सुरक्षा" value="पता केवल आपके खाते और चुनी हुई दुकान के साथ सुरक्षित रहेगा।" />
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingVertical: spacing.md,
      }}
    >
      <Text style={{ fontFamily: typography.headingMid.family, fontSize: 15, color: colors.ink }}>
        {label}
      </Text>
      <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}
