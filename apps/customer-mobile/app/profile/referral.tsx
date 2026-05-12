import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radii, spacing, typography } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';

export default function ReferralCodeScreen(): React.ReactElement {
  const router = useRouter();
  const { customer } = useCustomerSession();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
        <Pressable
          testID="referral-back-button"
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
          रेफरल कोड
        </Text>
        <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.inkMute, marginTop: spacing.xs }}>
          {customer?.name ? `${customer.name} के लिए` : 'आपके खाते के लिए'} साझा करने वाला कोड।
        </Text>

        <View
          testID="referral-backend-required"
          style={{
            backgroundColor: colors.white,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            marginTop: spacing.lg,
            alignItems: 'center',
          }}
        >
          <Text
            testID="referral-code-placeholder"
            style={{
              fontFamily: typography.headingMid.family,
              fontSize: 26,
              color: colors.inkMute,
              letterSpacing: 0,
            }}
          >
            जल्द उपलब्ध
          </Text>
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, marginTop: spacing.sm, textAlign: 'center' }}>
            आपका रेफरल कोड और earned points दुकान की सेवा जुड़ने के बाद दिखेंगे।
          </Text>
        </View>

        <View style={{ marginTop: spacing.md }}>
          <InfoRow label="साझा करना" value="कोड कॉपी करना और WhatsApp शेयर एक ही जगह से होगा।" />
          <InfoRow label="इनाम" value="रेफरल स्वीकार होने पर वफ़ादारी अंक अपने आप जुड़ेंगे।" />
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
