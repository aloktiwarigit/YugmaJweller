import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { getCustomerLoyalty } from '../../src/api/endpoints';
import type { LoyaltyState, LoyaltyTransaction } from '../../src/api/endpoints';

const TIER_LABELS: Record<string, string> = {
  SILVER:   'रजत',
  GOLD:     'स्वर्ण',
  PLATINUM: 'प्लेटिनम',
};

const TIER_COLORS: Record<string, string> = {
  SILVER:   '#9CA3AF',
  GOLD:     '#B8860B',
  PLATINUM: '#6366F1',
};

function TierBadge({ tier }: { tier: string }): React.ReactElement {
  const label = TIER_LABELS[tier] ?? tier;
  const color = TIER_COLORS[tier] ?? colors.ink;
  return (
    <View
      style={{
        backgroundColor: color + '22',
        borderRadius: radii.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: color,
      }}
    >
      <Text
        style={{ fontFamily: typography.body.family, fontSize: 13, color, fontWeight: '600' }}
      >
        {label}
      </Text>
    </View>
  );
}

function ProgressBar({ current, next }: { current: number; next: number }): React.ReactElement {
  const pct = next > 0 ? Math.min(1, current / next) : 1;
  return (
    <View
      style={{
        height: 8,
        backgroundColor: colors.border,
        borderRadius: 4,
        overflow: 'hidden',
        marginTop: spacing.xs,
      }}
    >
      <View
        style={{
          width: `${Math.round(pct * 100)}%`,
          height: '100%',
          backgroundColor: colors.ink,
          borderRadius: 4,
        }}
      />
    </View>
  );
}

function TransactionRow({ txn }: { txn: LoyaltyTransaction }): React.ReactElement {
  const positive = txn.pointsDelta >= 0;
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1, marginRight: spacing.sm }}>
        <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.ink }}>
          {txn.reason}
        </Text>
        <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute }}>
          {new Date(txn.createdAt).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: typography.body.family,
          fontSize: 15,
          fontWeight: '700',
          color: positive ? '#059669' : '#DC2626',
        }}
      >
        {positive ? '+' : ''}{txn.pointsDelta} अंक
      </Text>
    </View>
  );
}

export default function LoyaltyScreen(): React.ReactElement {
  const { isAuthenticated, customer } = useCustomerSession();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey:   ['customer-loyalty', customer?.id],
    queryFn:    getCustomerLoyalty,
    enabled:    isAuthenticated && customer !== null,
    staleTime:  30_000,
  });

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TenantBrandHeader />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: colors.inkMute, textAlign: 'center' }}>
            वफ़ादारी अंक देखने के लिए कृपया लॉग इन करें।
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Text
          style={{
            fontFamily: typography.display.family,
            fontSize: 22,
            color: colors.ink,
            marginBottom: spacing.md,
          }}
        >
          वफ़ादारी कार्यक्रम
        </Text>

        {isLoading ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: spacing.xl }} />
        ) : isError || !data ? (
          <View style={{ padding: spacing.md }}>
            <Text
              style={{ fontFamily: typography.body.family, color: '#DC2626', marginBottom: spacing.sm }}
              accessibilityRole="alert"
            >
              जानकारी लोड नहीं हो सकी।
            </Text>
            <Pressable
              onPress={() => { void refetch(); }}
              style={{
                backgroundColor: colors.ink,
                borderRadius: radii.sm,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                alignSelf: 'flex-start',
                minHeight: 44,
                justifyContent: 'center',
              }}
              accessibilityLabel="पुनः प्रयास"
            >
              <Text style={{ fontFamily: typography.body.family, color: colors.white }}>पुनः प्रयास</Text>
            </Pressable>
          </View>
        ) : (
          <LoyaltyContent state={data.state} transactions={data.transactions} />
        )}
      </ScrollView>
    </View>
  );
}

function LoyaltyContent({
  state,
  transactions,
}: {
  state:        LoyaltyState;
  transactions: LoyaltyTransaction[];
}): React.ReactElement {
  const TIER_THRESHOLDS: Record<string, number> = {
    SILVER: 500,
    GOLD:   2000,
  };
  const nextTier = state.currentTier === null
    ? 'SILVER'
    : state.currentTier === 'SILVER'
    ? 'GOLD'
    : state.currentTier === 'GOLD'
    ? 'PLATINUM'
    : null;

  return (
    <>
      {/* Balance card */}
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: radii.md,
          padding: spacing.lg,
          marginBottom: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            fontFamily: typography.headingMid.family,
            fontSize: 38,
            color: colors.ink,
            textAlign: 'center',
          }}
          accessibilityLabel={`${state.pointsBalance} अंक`}
        >
          {state.pointsBalance.toLocaleString('en-IN')}
        </Text>
        <Text
          style={{
            fontFamily: typography.body.family,
            fontSize: 14,
            color: colors.inkMute,
            textAlign: 'center',
            marginTop: spacing.xs,
          }}
        >
          वर्तमान अंक
        </Text>
        {state.currentTier ? (
          <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
            <TierBadge tier={state.currentTier} />
          </View>
        ) : null}
      </View>

      {/* Progress to next tier */}
      {nextTier && TIER_THRESHOLDS[nextTier] ? (
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: radii.md,
            padding: spacing.md,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, marginBottom: spacing.xs }}>
            {TIER_LABELS[nextTier] ?? nextTier} स्तर तक
          </Text>
          <ProgressBar
            current={state.lifetimePoints}
            next={TIER_THRESHOLDS[nextTier]}
          />
          <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute, marginTop: spacing.xs }}>
            {Math.max(0, (TIER_THRESHOLDS[nextTier]) - state.lifetimePoints).toLocaleString('en-IN')} अंक और चाहिए
          </Text>
        </View>
      ) : null}

      {/* Recent transactions */}
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: radii.md,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            fontFamily: typography.headingMid.family,
            fontSize: 16,
            color: colors.ink,
            marginBottom: spacing.sm,
          }}
        >
          हाल के लेन-देन
        </Text>
        {transactions.length === 0 ? (
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute }}>
            अभी कोई लेन-देन नहीं है।
          </Text>
        ) : (
          transactions.map((txn) => <TransactionRow key={txn.id} txn={txn} />)
        )}
      </View>
    </>
  );
}
