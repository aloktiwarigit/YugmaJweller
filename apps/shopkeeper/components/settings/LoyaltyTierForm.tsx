import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Button } from '@goldsmith/ui-mobile';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';

// ---------------------------------------------------------------------------
// Validation — mirrors PatchLoyaltyTierSchema from @goldsmith/shared
// (shopkeeper does not depend on @goldsmith/shared; rules kept in sync manually)
// ---------------------------------------------------------------------------

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const MAX_THRESHOLD_RUPEES = 10_000_000; // ₹1 crore

type TierErrors = {
  name?: string;
  thresholdRupees?: string;
  badgeColor?: string;
};

function validateTier(
  name: string,
  thresholdRupees: string,
  badgeColor: string,
): TierErrors {
  const errors: TierErrors = {};

  if (name.trim().length === 0) {
    errors.name = 'TIER_NAME_REQUIRED';
  } else if (name.length > 20) {
    errors.name = 'TIER_NAME_TOO_LONG';
  }

  const thresholdNum = parseFloat(thresholdRupees);
  if (!/^\d+(\.\d{1,2})?$/.test(thresholdRupees)) {
    errors.thresholdRupees = 'VALUE_FORMAT_INVALID';
  } else if (!Number.isInteger(thresholdNum * 100)) {
    errors.thresholdRupees = 'THRESHOLD_MUST_BE_INTEGER';
  } else if (thresholdNum < 0) {
    errors.thresholdRupees = 'THRESHOLD_MIN';
  } else if (thresholdNum > MAX_THRESHOLD_RUPEES) {
    errors.thresholdRupees = 'THRESHOLD_MAX';
  }

  if (!HEX_COLOR_REGEX.test(badgeColor)) {
    errors.badgeColor = 'BADGE_COLOR_INVALID';
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LoyaltyTierFormProps {
  tierIndex: 0 | 1 | 2;
  initialName: string;
  /** "50000.00" — string form for display */
  initialThresholdRupees: string;
  /** "#C0C0C0" */
  initialBadgeColor: string;
  onSave: (patch: {
    name: string;
    thresholdRupees: string;
    badgeColor: string;
  }) => void;
  isSaving: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoyaltyTierForm({
  tierIndex,
  initialName,
  initialThresholdRupees,
  initialBadgeColor,
  onSave,
  isSaving,
}: LoyaltyTierFormProps): React.ReactElement {
  const [name, setName] = useState(initialName);
  const [thresholdRupees, setThresholdRupees] = useState(initialThresholdRupees);
  const [badgeColor, setBadgeColor] = useState(initialBadgeColor);
  const [errors, setErrors] = useState<TierErrors>({});

  const idx = tierIndex;

  const handleSave = (): void => {
    const validationErrors = validateTier(name, thresholdRupees, badgeColor);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    onSave({ name, thresholdRupees, badgeColor });
  };

  return (
    <View style={styles.container}>
      {/* Tier Name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>टियर का नाम</Text>
        <TextInput
          testID={`tier-${idx}-name`}
          style={[styles.input, errors.name !== undefined ? styles.inputError : null]}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          editable={!isSaving}
          maxLength={20}
          accessibilityLabel="टियर का नाम"
        />
        {errors.name !== undefined && (
          <Text
            testID={`tier-${idx}-name-error`}
            style={styles.errorText}
            accessibilityLiveRegion="polite"
          >
            {errors.name}
          </Text>
        )}
      </View>

      {/* Threshold */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>न्यूनतम खरीद (₹)</Text>
        <TextInput
          testID={`tier-${idx}-threshold`}
          style={[styles.input, errors.thresholdRupees !== undefined ? styles.inputError : null]}
          value={thresholdRupees}
          onChangeText={(v) => {
            setThresholdRupees(v);
            setErrors((prev) => ({ ...prev, thresholdRupees: undefined }));
          }}
          keyboardType="numeric"
          editable={!isSaving}
          accessibilityLabel="न्यूनतम खरीद"
        />
        {errors.thresholdRupees !== undefined && (
          <Text
            testID={`tier-${idx}-threshold-error`}
            style={styles.errorText}
            accessibilityLiveRegion="polite"
          >
            {errors.thresholdRupees}
          </Text>
        )}
      </View>

      {/* Badge Color */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>बैज रंग</Text>
        <TextInput
          testID={`tier-${idx}-badge-color`}
          style={[styles.input, errors.badgeColor !== undefined ? styles.inputError : null]}
          value={badgeColor}
          onChangeText={(v) => {
            setBadgeColor(v);
            setErrors((prev) => ({ ...prev, badgeColor: undefined }));
          }}
          editable={!isSaving}
          autoCapitalize="characters"
          maxLength={7}
          accessibilityLabel="बैज रंग"
        />
        {errors.badgeColor !== undefined && (
          <Text
            testID={`tier-${idx}-badge-color-error`}
            style={styles.errorText}
            accessibilityLiveRegion="polite"
          >
            {errors.badgeColor}
          </Text>
        )}
      </View>

      {/* Save button */}
      <Button
        testID={`tier-${idx}-save`}
        label={isSaving ? 'सहेज रहे हैं…' : 'सहेजें'}
        onPress={handleSave}
        disabled={isSaving}
        loading={isSaving}
        variant="primary"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 6,
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
});
