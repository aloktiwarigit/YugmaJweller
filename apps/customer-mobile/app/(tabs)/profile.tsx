import React, { useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { LoyaltyPointsCard } from '../../src/components/LoyaltyPointsCard';
import { TimelineTabBar } from '../../src/components/timeline/TimelineTabBar';
import { TimelinePurchases } from '../../src/components/timeline/TimelinePurchases';
import { TimelineCustomOrders } from '../../src/components/timeline/TimelineCustomOrders';
import { TimelineRateLocks } from '../../src/components/timeline/TimelineRateLocks';
import { TimelineTryAtHome } from '../../src/components/timeline/TimelineTryAtHome';
import { TimelineReviews } from '../../src/components/timeline/TimelineReviews';
import type { TimelineTab } from '../../src/components/timeline/TimelineTabBar';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { customerSelfDelete, type TypedApiError } from '../../src/api/endpoints';

type DeleteStep = 'idle' | 'confirm' | 'submitting';

function getDeletionErrorMessage(error: unknown): string {
  const code = (error as Partial<TypedApiError> | undefined)?.code;
  if (code === 'crm.deletion.open_invoices') {
    return 'खुले बिल होने के कारण हटाने का अनुरोध अभी नहीं हो सकता। कृपया दुकान से संपर्क करें।';
  }
  if (code === 'crm.deletion.already_requested') {
    return 'हटाने का अनुरोध पहले से चल रहा है। कृपया लॉग आउट करके बाद में देखें।';
  }
  return 'हटाने का अनुरोध नहीं हो सका। कृपया फिर कोशिश करें या दुकान से संपर्क करें।';
}

export default function Profile(): React.ReactElement {
  const { customer, signOut } = useCustomerSession();
  const [activeTab, setActiveTab] = useState<TimelineTab>('purchases');
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Lazy-mount: each tab renders only after first activation, then stays mounted.
  const activated = useRef<Set<TimelineTab>>(new Set(['purchases']));
  const handleTabChange = (tab: TimelineTab): void => {
    activated.current.add(tab);
    setActiveTab(tab);
  };

  const onRequestDeletion = async (): Promise<void> => {
    if (deleteStep === 'submitting') return;
    if (deleteStep !== 'confirm') {
      setDeleteError(null);
      setDeleteStep('confirm');
      return;
    }

    setDeleteError(null);
    setDeleteStep('submitting');
    try {
      await customerSelfDelete();
      await signOut();
    } catch (error) {
      setDeleteError(getDeletionErrorMessage(error));
      setDeleteStep('confirm');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ScrollView nestedScrollEnabled>
        {/* ── Profile header ── */}
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text style={{ fontFamily: typography.display.family, fontSize: 22, color: colors.ink }}>
            {customer?.name ?? '-'}
          </Text>
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, marginTop: spacing.xs }}>
            {customer?.phoneE164 ?? ''}
          </Text>
        </View>

        <LoyaltyPointsCard />

        {/* ── Timeline ── */}
        <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TimelineTabBar activeTab={activeTab} onTabChange={handleTabChange} />
          <View style={{ minHeight: 200 }}>
            {activated.current.has('purchases') && (
              <View style={{ display: activeTab === 'purchases' ? 'flex' : 'none' }}>
                <TimelinePurchases />
              </View>
            )}
            {activated.current.has('custom-orders') && (
              <View style={{ display: activeTab === 'custom-orders' ? 'flex' : 'none' }}>
                <TimelineCustomOrders />
              </View>
            )}
            {activated.current.has('rate-locks') && (
              <View style={{ display: activeTab === 'rate-locks' ? 'flex' : 'none' }}>
                <TimelineRateLocks />
              </View>
            )}
            {activated.current.has('try-at-home') && (
              <View style={{ display: activeTab === 'try-at-home' ? 'flex' : 'none' }}>
                <TimelineTryAtHome />
              </View>
            )}
            {activated.current.has('reviews') && (
              <View style={{ display: activeTab === 'reviews' ? 'flex' : 'none' }}>
                <TimelineReviews />
              </View>
            )}
          </View>
        </View>

        {/* ── Account actions ── */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Pressable
              testID="profile-delete-button"
              onPress={onRequestDeletion}
              disabled={deleteStep === 'submitting'}
              style={{
                backgroundColor: colors.white,
                borderRadius:    radii.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
                borderWidth:     1,
                borderColor:     colors.border,
                minHeight:       48,
                justifyContent:  'center',
              }}
              accessibilityRole="button"
              accessibilityLabel={deleteStep === 'confirm' ? 'डेटा हटाने का अनुरोध पुष्टि करें' : 'डेटा हटाने का अनुरोध करें'}
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: '#8C2A1E', textAlign: 'center' }}>
                {deleteStep === 'submitting'
                  ? 'अनुरोध भेजा जा रहा है...'
                  : deleteStep === 'confirm'
                    ? 'डेटा हटाने की पुष्टि करें'
                    : 'डेटा हटाने का अनुरोध करें'}
              </Text>
            </Pressable>
            <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute, textAlign: 'center', marginTop: spacing.xs }}>
              {deleteError ?? (deleteStep === 'confirm'
                ? 'प्रोफ़ाइल डेटा अभी हटाया जाएगा और अंतिम हटाने की प्रक्रिया तय होगी।'
                : 'अनुरोध स्वीकार होने के बाद आपका खाता लॉग आउट हो जाएगा।')}
            </Text>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <Pressable
              testID="profile-signout-button"
              onPress={() => { void signOut(); }}
              style={{ paddingVertical: spacing.md, minHeight: 48, justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel="लॉग आउट"
            >
              <Text style={{ fontFamily: typography.body.family, color: colors.inkMute, textAlign: 'center' }}>
                लॉग आउट
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
