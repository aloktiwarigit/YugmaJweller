import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Button } from '@goldsmith/ui-mobile';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';

type Role = 'shop_staff' | 'shop_manager';

export interface StaffInviteFormProps {
  onSubmit: (data: {
    phone: string;
    role: Role;
    display_name: string;
  }) => void;
  loading?: boolean;
  error?: string | null;
}

export function StaffInviteForm({
  onSubmit,
  loading = false,
  error = null,
}: StaffInviteFormProps): React.ReactElement {
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('shop_staff');

  const handleSubmit = (): void => {
    onSubmit({ phone, role, display_name: displayName });
  };

  return (
    <View style={styles.container}>
      {/* Name field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>नाम</Text>
        <TextInput
          testID="invite-name-input"
          style={styles.input}
          placeholder="स्टाफ का नाम"
          placeholderTextColor={colors.inkMute}
          value={displayName}
          onChangeText={setDisplayName}
          editable={!loading}
        />
      </View>

      {/* Phone field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>मोबाइल नंबर</Text>
        <TextInput
          testID="invite-phone-input"
          style={styles.input}
          placeholder="+91XXXXXXXXXX"
          placeholderTextColor={colors.inkMute}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!loading}
          autoComplete="tel"
        />
      </View>

      {/* Role selector */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>भूमिका</Text>
        <View style={styles.roleRow}>
          <TouchableOpacity
            testID="invite-role-staff"
            accessibilityRole="button"
            accessibilityState={{ selected: role === 'shop_staff' }}
            style={[
              styles.roleButton,
              role === 'shop_staff' && styles.roleButtonSelected,
            ]}
            onPress={() => setRole('shop_staff')}
            disabled={loading}
          >
            <Text
              style={[
                styles.roleButtonText,
                role === 'shop_staff' && styles.roleButtonTextSelected,
              ]}
            >
              स्टाफ
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="invite-role-manager"
            accessibilityRole="button"
            accessibilityState={{ selected: role === 'shop_manager' }}
            style={[
              styles.roleButton,
              role === 'shop_manager' && styles.roleButtonSelected,
            ]}
            onPress={() => setRole('shop_manager')}
            disabled={loading}
          >
            <Text
              style={[
                styles.roleButtonText,
                role === 'shop_manager' && styles.roleButtonTextSelected,
              ]}
            >
              मैनेजर
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Error message */}
      {error !== null && error !== undefined && error.length > 0 && (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      {/* Submit */}
      <Button
        label="आमंत्रण भेजें"
        onPress={handleSubmit}
        loading={loading}
        disabled={loading}
        testID="invite-submit"
        variant="primary"
      />
    </View>
  );
}

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
    color: colors.ink,
    marginBottom: 6,
    fontWeight: '600',
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
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleButton: {
    flex: 1,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  roleButtonSelected: {
    borderColor: colors.primary, // aged gold #B58A3C
    backgroundColor: '#FDF6EA',
  },
  roleButtonText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.inkMute,
    fontWeight: '500',
  },
  roleButtonTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
