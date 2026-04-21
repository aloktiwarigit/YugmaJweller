import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Toast } from '@goldsmith/ui-mobile';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { LoyaltyTierForm } from '../../components/settings/LoyaltyTierForm';
import { api } from '../../src/api/client';
import type { AxiosError } from 'axios';

// ---------------------------------------------------------------------------
// Types (mirror shapes from @goldsmith/shared without importing it)
// ---------------------------------------------------------------------------

interface LoyaltyTierData {
  name: string;
  thresholdPaise: number;
  badgeColor: string;
}

interface LoyaltyConfigData {
  tiers: [LoyaltyTierData, LoyaltyTierData, LoyaltyTierData];
  earnRatePercentage: string;
  redemptionRatePercentage: string;
}

// Defaults mirror LOYALTY_DEFAULTS from @goldsmith/shared
const TIER_DEFAULTS: LoyaltyConfigData = {
  tiers: [
    { name: 'Silver',  thresholdPaise: 5_000_000,  badgeColor: '#C0C0C0' },
    { name: 'Gold',    thresholdPaise: 15_000_000,  badgeColor: '#FFD700' },
    { name: 'Diamond', thresholdPaise: 50_000_000,  badgeColor: '#B9F2FF' },
  ],
  earnRatePercentage:       '1.00',
  redemptionRatePercentage: '1.00',
};

function paiseToRupeesStr(paise: number): string {
  return (paise / 100).toFixed(2);
}

// ---------------------------------------------------------------------------
// Rate validation (mirrors positiveDecimalString from @goldsmith/shared)
// ---------------------------------------------------------------------------

function validateRate(value: string): string | undefined {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'VALUE_FORMAT_INVALID';
  const n = parseFloat(value);
  if (n <= 0 || n > 100) return 'RATE_OUT_OF_RANGE';
  return undefined;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function LoyaltyScreen(): React.ReactElement {
  const [config, setConfig] = useState<LoyaltyConfigData>(TIER_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [savingTier, setSavingTier] = useState<0 | 1 | 2 | null>(null);
  const [savingRate, setSavingRate] = useState(false);

  const [earnRate, setEarnRate]           = useState(TIER_DEFAULTS.earnRatePercentage);
  const [redemptionRate, setRedemptionRate] = useState(TIER_DEFAULTS.redemptionRatePercentage);
  const [earnRateError, setEarnRateError]   = useState<string | undefined>();
  const [redemptionRateError, setRedemptionRateError] = useState<string | undefined>();

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch current config
  // ---------------------------------------------------------------------------

  const fetchConfig = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await api.get<LoyaltyConfigData>('/api/v1/settings/loyalty');
      setConfig(res.data);
      setEarnRate(res.data.earnRatePercentage);
      setRedemptionRate(res.data.redemptionRatePercentage);
    } catch {
      // Fall through — show defaults while loading fails (non-blocking)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  // ---------------------------------------------------------------------------
  // Toast helpers
  // ---------------------------------------------------------------------------

  const showSuccess = (msg: string): void => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const showError = (msg: string): void => {
    setErrorMsg(msg);
    setSuccessMsg(null);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  // ---------------------------------------------------------------------------
  // Save tier
  // ---------------------------------------------------------------------------

  const handleSaveTier = async (
    index: 0 | 1 | 2,
    patch: { name: string; thresholdRupees: string; badgeColor: string },
  ): Promise<void> => {
    setSavingTier(index);
    try {
      await api.patch('/api/v1/settings/loyalty', {
        type: 'tier',
        index,
        name: patch.name,
        thresholdRupees: patch.thresholdRupees,
        badgeColor: patch.badgeColor,
      });
      showSuccess('बदलाव सहेज लिया ✓');
      void fetchConfig();
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const serverMsg = axiosErr.response?.data?.message;
      showError(typeof serverMsg === 'string' ? serverMsg : 'बदलाव सहेज नहीं हो सका। दोबारा कोशिश करें।');
    } finally {
      setSavingTier(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Save rates
  // ---------------------------------------------------------------------------

  const handleSaveRates = async (): Promise<void> => {
    const earnErr      = validateRate(earnRate);
    const redemptionErr = validateRate(redemptionRate);
    setEarnRateError(earnErr);
    setRedemptionRateError(redemptionErr);
    if (earnErr !== undefined || redemptionErr !== undefined) return;

    setSavingRate(true);
    try {
      await api.patch('/api/v1/settings/loyalty', {
        type: 'rate',
        earnRatePercentage: earnRate,
        redemptionRatePercentage: redemptionRate,
      });
      showSuccess('बदलाव सहेज लिया ✓');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const serverMsg = axiosErr.response?.data?.message;
      showError(typeof serverMsg === 'string' ? serverMsg : 'दर सहेज नहीं हो सका। दोबारा कोशिश करें।');
    } finally {
      setSavingRate(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const tierNames = ['Silver', 'Gold', 'Diamond'] as const;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Toasts */}
      {successMsg !== null && (
        <View style={styles.toastWrapper}>
          <Toast message={successMsg} variant="info" testID="loyalty-success-toast" />
        </View>
      )}
      {errorMsg !== null && (
        <View style={styles.toastWrapper}>
          <Toast message={errorMsg} variant="error" testID="loyalty-error-toast" />
        </View>
      )}

      {/* Page heading */}
      <Text style={styles.pageTitle}>लॉयल्टी प्रोग्राम</Text>

      {/* Tiers section */}
      <Text style={styles.sectionTitle}>टियर</Text>
      {([0, 1, 2] as const).map((idx) => {
        const tier = loading ? TIER_DEFAULTS.tiers[idx] : config.tiers[idx];
        return (
          <View key={idx} style={styles.card} testID={`tier-card-${idx}`}>
            <Text style={styles.cardHeader}>
              {tierNames[idx]}
            </Text>
            <LoyaltyTierForm
              tierIndex={idx}
              initialName={tier.name}
              initialThresholdRupees={paiseToRupeesStr(tier.thresholdPaise)}
              initialBadgeColor={tier.badgeColor}
              onSave={(patch) => void handleSaveTier(idx, patch)}
              isSaving={savingTier === idx}
            />
          </View>
        );
      })}

      {/* Rates section */}
      <Text style={styles.sectionTitle}>पॉइंट्स दर</Text>
      <View style={styles.card}>
        {/* Earn rate */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>अर्जन दर (%)</Text>
          <TextInput
            testID="earn-rate-input"
            style={[styles.input, earnRateError !== undefined ? styles.inputError : null]}
            value={earnRate}
            onChangeText={(v) => {
              setEarnRate(v);
              setEarnRateError(undefined);
            }}
            keyboardType="numeric"
            editable={!savingRate}
            accessibilityLabel="अर्जन दर"
          />
          {earnRateError !== undefined && (
            <Text style={styles.errorText} testID="earn-rate-error" accessibilityLiveRegion="polite">
              {earnRateError}
            </Text>
          )}
        </View>

        {/* Redemption rate */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>रिडेम्प्शन दर (%)</Text>
          <TextInput
            testID="redemption-rate-input"
            style={[styles.input, redemptionRateError !== undefined ? styles.inputError : null]}
            value={redemptionRate}
            onChangeText={(v) => {
              setRedemptionRate(v);
              setRedemptionRateError(undefined);
            }}
            keyboardType="numeric"
            editable={!savingRate}
            accessibilityLabel="रिडेम्प्शन दर"
          />
          {redemptionRateError !== undefined && (
            <Text style={styles.errorText} testID="redemption-rate-error" accessibilityLiveRegion="polite">
              {redemptionRateError}
            </Text>
          )}
        </View>

        {/* Save rates button */}
        <View style={styles.ratesSaveWrapper}>
          <Text
            testID="rates-save-btn"
            onPress={savingRate ? undefined : () => void handleSaveRates()}
            style={[styles.saveRatesBtn, savingRate ? styles.saveRatesBtnDisabled : null]}
            accessibilityRole="button"
            accessibilityLabel="दर सहेजें"
          >
            {savingRate ? 'सहेज रहे हैं…' : 'सहेजें'}
          </Text>
        </View>
      </View>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  contentContainer: {
    paddingBottom: spacing.xl,
  },
  toastWrapper: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: typography.display.family,
    color: colors.ink,
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontFamily: typography.headingMid.family,
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMute,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    fontFamily: typography.headingMid.family,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  fieldGroup: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  label: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.error,
    marginTop: 4,
  },
  ratesSaveWrapper: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  saveRatesBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    textAlign: 'center',
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    minHeight: 48,
    overflow: 'hidden',
  },
  saveRatesBtnDisabled: {
    opacity: 0.5,
  },
});
