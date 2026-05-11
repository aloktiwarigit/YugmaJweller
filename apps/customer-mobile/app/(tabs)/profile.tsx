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
import { customerSelfDelete } from '../../src/api/endpoints';

export default function Profile(): React.ReactElement {
  const { customer, signOut } = useCustomerSession();
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [activeTab, setActiveTab] = useState<TimelineTab>('purchases');

  // Lazy-mount: each tab renders only after first activation, then stays mounted.
  const activated = useRef<Set<TimelineTab>>(new Set(['purchases']));
  const handleTabChange = (tab: TimelineTab): void => {
    activated.current.add(tab);
    setActiveTab(tab);
  };

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
              onPress={() => { void onDelete(); }}
              disabled={deleting}
              style={{
                backgroundColor: colors.white,
                borderRadius:    radii.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
                borderWidth:     1,
                borderColor:     colors.border,
                minHeight:       48,
                justifyContent:  'center',
                opacity:         deleting ? 0.5 : 1,
              }}
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: '#8C2A1E', textAlign: 'center' }}>
                डेटा हटाएं (Delete my data)
              </Text>
            </Pressable>
            {resultMsg !== null && (
              <View
                testID="profile-delete-result"
                style={{ marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.bg, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>{resultMsg}</Text>
              </View>
            )}
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <Pressable
              testID="profile-signout-button"
              onPress={() => { void signOut(); }}
              style={{ paddingVertical: spacing.md, minHeight: 48, justifyContent: 'center' }}
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
