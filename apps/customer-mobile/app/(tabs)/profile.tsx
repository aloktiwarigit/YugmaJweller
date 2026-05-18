import React, { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
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

export default function Profile(): React.ReactElement {
  const { customer, signOut } = useCustomerSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TimelineTab>('purchases');

  // Lazy-mount: each tab renders only after first activation, then stays mounted.
  const activated = useRef<Set<TimelineTab>>(new Set(['purchases']));
  const handleTabChange = (tab: TimelineTab): void => {
    activated.current.add(tab);
    setActiveTab(tab);
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
              onPress={() => router.push('/profile/delete-account' as any)}
              style={{
                backgroundColor:   colors.white,
                borderRadius:      radii.md,
                paddingVertical:   spacing.md,
                paddingHorizontal: spacing.md,
                borderWidth:       1,
                borderColor:       colors.border,
                minHeight:         48,
                justifyContent:    'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="डेटा हटाने का अनुरोध करें"
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: '#8C2A1E', textAlign: 'center' }}>
                डेटा हटाएँ
              </Text>
            </Pressable>
            <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute, textAlign: 'center', marginTop: spacing.xs }}>
              खाता हटाने की प्रक्रिया अगले स्क्रीन पर समझाई गई है।
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
