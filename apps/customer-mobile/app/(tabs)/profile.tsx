import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { LoyaltyPointsCard } from '../../src/components/LoyaltyPointsCard';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { customerSelfDelete } from '../../src/api/endpoints';

export default function Profile(): React.ReactElement {
  const { customer, signOut } = useCustomerSession();
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onDelete = async (): Promise<void> => {
    if (deleting) return;
    setDeleting(true);
    setResultMsg(null);
    try {
      await customerSelfDelete();
      setResultMsg('अनुरोध स्वीकार हुआ');
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'unknown';
      if (code === 'deletion.customer_app_not_yet_available') {
        setResultMsg('जल्द आ रहा है। (coming soon)');
      } else {
        setResultMsg('अभी संभव नहीं है। बाद में पुनः प्रयास करें।');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <Text
          style={{ fontFamily: typography.display.family, fontSize: 22, color: colors.ink }}
        >
          {customer?.name ?? '-'}
        </Text>
        <Text
          style={{
            fontFamily: typography.body.family,
            fontSize: 14,
            color: colors.inkMute,
            marginTop: spacing.xs,
          }}
        >
          {customer?.phoneE164 ?? ''}
        </Text>
      </View>
      <LoyaltyPointsCard />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Pressable
          testID="profile-delete-button"
          onPress={() => { void onDelete(); }}
          disabled={deleting}
          style={{
            backgroundColor: colors.white,
            borderRadius: radii.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            minHeight: 48,
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: typography.body.family,
              fontSize: 16,
              color: '#8C2A1E',
              textAlign: 'center',
            }}
          >
            डेटा हटाएं (Delete my data)
          </Text>
        </Pressable>
        {resultMsg !== null ? (
          <View
            testID="profile-delete-result"
            style={{
              marginTop: spacing.sm,
              padding: spacing.sm,
              backgroundColor: colors.bg,
              borderRadius: radii.sm,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>
              {resultMsg}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <Pressable
          testID="profile-signout-button"
          onPress={() => { void signOut(); }}
          style={{
            paddingVertical: spacing.md,
            minHeight: 48,
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: typography.body.family,
              color: colors.inkMute,
              textAlign: 'center',
            }}
          >
            लॉग आउट
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
