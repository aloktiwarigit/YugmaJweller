import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, radii } from '@goldsmith/ui-tokens';
import { Toast, RateUpdateToast } from '@goldsmith/ui-mobile';
import { useAuthStore } from '../../src/stores/authStore';
import { api } from '../../src/api/client';
import type { PurityKey } from '@goldsmith/shared';


// ---------------------------------------------------------------------------
// Purity options
// ---------------------------------------------------------------------------

const PURITY_OPTIONS: { key: PurityKey; label: string }[] = [
  { key: 'GOLD_24K', label: '24K' },
  { key: 'GOLD_22K', label: '22K' },
  { key: 'GOLD_20K', label: '20K' },
  { key: 'GOLD_18K', label: '18K' },
  { key: 'GOLD_14K', label: '14K' },
  { key: 'SILVER_999', label: 'चांदी 999' },
  { key: 'SILVER_925', label: 'चांदी 925' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// GET /rates/current always returns base IBJA rates (no tenant overrides).
// Correct — the override screen must show the real market price as the baseline.
interface CurrentRatesResponse {
  [purity: string]: {
    perGramPaise: string;
    perGramRupees: string;
    fetchedAt: string;
  } | boolean | string;
  stale: boolean;
  source: string;
}

function parseDiff(ibjaRupees: string, overrideInput: string): string | null {
  const ibja = parseFloat(ibjaRupees.replace(/[^0-9.]/g, ''));
  const ov = parseFloat(overrideInput);
  if (isNaN(ibja) || isNaN(ov)) return null;
  const diff = ov - ibja;
  if (diff === 0) return null;
  const sign = diff > 0 ? '+' : '';
  return diff > 0
    ? `${sign}₹${Math.abs(diff).toFixed(2)} से अधिक`
    : `-₹${Math.abs(diff).toFixed(2)} कम`;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function RateOverrideScreen(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'shop_admin';
  const queryClient = useQueryClient();

  const [selectedPurity, setSelectedPurity] = useState<PurityKey>('GOLD_22K');
  const [overrideInput, setOverrideInput] = useState('');
  const [reason, setReason] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'info' | 'error'>('info');
  const [inputError, setInputError] = useState<string | null>(null);
  // Track the last successfully-set override per purity (for the active banner)
  const [lastSetOverride, setLastSetOverride] = useState<{ purity: PurityKey; rupees: string } | null>(null);

  const { data: ratesData, isLoading: ratesLoading } = useQuery<CurrentRatesResponse>({
    queryKey: ['rates', 'current'],
    queryFn: async () => {
      const res = await api.get('/api/v1/rates/current');
      return res.data as CurrentRatesResponse;
    },
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (payload: {
      purity: PurityKey;
      overrideRupees: string;
      reason: string;
    }) => {
      await api.post('/api/v1/rates/override', payload);
    },
    onSuccess: (_data, payload) => {
      void queryClient.invalidateQueries({ queryKey: ['rates'] });
      setLastSetOverride({ purity: payload.purity, rupees: payload.overrideRupees });
      setShowToast(true);
      setOverrideInput('');
      setReason('');
    },
    onError: () => {
      setToastMessage('त्रुटि: दर सेट करने में समस्या हुई');
      setToastVariant('error');
    },
  });

  const selectedPurityEntry = ratesData?.[selectedPurity] as
    | { perGramPaise: string; perGramRupees: string }
    | undefined;
  // Always base IBJA rate — GET /rates/current never applies tenant overrides
  const ibjaRupees = selectedPurityEntry ? selectedPurityEntry.perGramRupees : null;

  // Show banner only when the shopkeeper just set an override this session
  const activeBanner = lastSetOverride !== null && lastSetOverride.purity === selectedPurity
    ? { rupees: lastSetOverride.rupees }
    : null;

  const validateInput = useCallback((val: string): boolean => {
    if (!/^\d+(\.\d{1,2})?$/.test(val)) {
      setInputError('केवल संख्या और 2 दशमलव अंक तक');
      return false;
    }
    const n = parseFloat(val);
    if (n <= 0 || n >= 200000) {
      setInputError('दर ₹1 से ₹2,00,000 के बीच होनी चाहिए');
      return false;
    }
    setInputError(null);
    return true;
  }, []);

  function handleSave(): void {
    if (!validateInput(overrideInput)) return;
    if (reason.trim().length < 3) {
      setInputError('कारण कम से कम 3 अक्षर का होना चाहिए');
      return;
    }
    mutation.mutate({ purity: selectedPurity, overrideRupees: overrideInput, reason: reason.trim() });
  }

  const diff = ibjaRupees && overrideInput ? parseDiff(ibjaRupees, overrideInput) : null;

  return (
    <View style={styles.screen}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Purity selector */}
      <Text style={styles.sectionLabel} accessibilityRole="header">
        शुद्धता चुनें
      </Text>
      <View style={styles.segmentRow} accessibilityRole="radiogroup">
        {PURITY_OPTIONS.map((opt) => {
          const active = selectedPurity === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setSelectedPurity(opt.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* History link */}
      <Pressable
        onPress={() => router.push('/rates/history' as Parameters<typeof router.push>[0])}
        style={styles.historyLink}
        accessibilityRole="link"
        accessibilityLabel="भाव इतिहास देखें"
      >
        <Text style={styles.historyLinkText}>इतिहास देखें →</Text>
      </Pressable>

      {/* Current IBJA rate display */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>IBJA बाज़ार दर</Text>
        {ratesLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.ibjaRate} accessibilityLabel={`IBJA दर ${ibjaRupees ?? '—'} प्रति ग्राम`}>
            {ibjaRupees ?? '—'} / ग्राम
          </Text>
        )}
      </View>

      {/* Active override banner */}
      {activeBanner && (
        <View style={styles.overrideBanner} accessible accessibilityLiveRegion="polite">
          <Text style={styles.overrideBannerText}>
            Override सेट: ₹{activeBanner.rupees} / ग्राम (इस सत्र में)
          </Text>
        </View>
      )}

      {/* Override input */}
      <Text style={styles.sectionLabel}>नई दर (₹ प्रति ग्राम)</Text>
      <TextInput
        style={[styles.input, !!inputError && styles.inputError, !isOwner && styles.inputDisabled]}
        value={overrideInput}
        onChangeText={(val) => {
          setOverrideInput(val);
          setInputError(null);
        }}
        onBlur={() => overrideInput ? validateInput(overrideInput) : undefined}
        keyboardType="decimal-pad"
        placeholder="जैसे 6842.50"
        placeholderTextColor={colors.textSecondary}
        editable={isOwner}
        accessibilityLabel="नई दर प्रति ग्राम"
        accessibilityHint="₹ में प्रति ग्राम दर दर्ज करें"
        returnKeyType="done"
        maxLength={10}
      />
      {diff && (
        <Text style={styles.diffText} accessibilityLabel={`IBJA से अंतर: ${diff}`}>
          {diff}
        </Text>
      )}
      {inputError && (
        <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {inputError}
        </Text>
      )}

      {/* Reason input */}
      <Text style={styles.sectionLabel}>कारण</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline, !isOwner && styles.inputDisabled]}
        value={reason}
        onChangeText={setReason}
        placeholder="दर बदलने का कारण (जैसे: त्योहारी मूल्य)"
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={3}
        editable={isOwner}
        accessibilityLabel="दर बदलने का कारण"
        maxLength={500}
      />

      {/* Save button (OWNER only) */}
      {isOwner ? (
        <Pressable
          style={[styles.saveBtn, mutation.isPending && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={mutation.isPending || !overrideInput || !reason}
          accessibilityRole="button"
          accessibilityLabel="दर सेट करें"
          accessibilityState={{ disabled: mutation.isPending || !overrideInput || !reason }}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>दर सेट करें</Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.ownerOnlyNote} accessible>
          <Text style={styles.ownerOnlyText}>
            केवल मालिक (OWNER) दर बदल सकते हैं
          </Text>
        </View>
      )}

      {/* Error toast */}
      {toastMessage && (
        <View style={styles.toastWrapper}>
          <Toast message={toastMessage} variant={toastVariant} />
        </View>
      )}
    </ScrollView>
    <RateUpdateToast visible={showToast} onDismiss={() => setShowToast(false)} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl ?? 32,
  },
  sectionLabel: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs ?? 4,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs ?? 4,
    marginBottom: spacing.sm ?? 8,
  },
  segmentBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.sm ?? 8,
    paddingVertical: 12,
    borderRadius: radii.sm ?? 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  segmentText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textPrimary,
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md ?? 8,
    padding: spacing.md,
    marginVertical: spacing.sm ?? 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: {
    fontFamily: typography.body.family,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  ibjaRate: {
    fontFamily: typography.body.family,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  overrideBanner: {
    backgroundColor: '#FFF8E1',
    borderRadius: radii.sm ?? 4,
    borderWidth: 1,
    borderColor: '#FFD600',
    padding: spacing.sm ?? 8,
    marginBottom: spacing.sm ?? 8,
  },
  overrideBannerText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: '#5D4037',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm ?? 4,
    paddingHorizontal: spacing.sm ?? 8,
    paddingVertical: 12,
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    marginBottom: spacing.xs ?? 4,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    color: colors.textSecondary,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  diffText: {
    fontFamily: typography.body.family,
    fontSize: 13,
    color: colors.inkMute,
    marginBottom: spacing.xs ?? 4,
  },
  errorText: {
    fontFamily: typography.body.family,
    fontSize: 13,
    color: colors.error,
    marginBottom: spacing.sm ?? 8,
  },
  saveBtn: {
    minHeight: 56,
    backgroundColor: colors.primary,
    borderRadius: radii.md ?? 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg ?? 24,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: typography.body.family,
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  ownerOnlyNote: {
    marginTop: spacing.lg ?? 24,
    padding: spacing.md,
    backgroundColor: '#F5F5F5',
    borderRadius: radii.sm ?? 4,
    alignItems: 'center',
  },
  ownerOnlyText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textSecondary,
  },
  toastWrapper: {
    marginTop: spacing.md,
  },
  historyLink: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm ?? 8,
    padding: 4,
  },
  historyLinkText: {
    fontFamily: typography.body.family,
    fontSize: 13,
    color: colors.primary,
  },
});
