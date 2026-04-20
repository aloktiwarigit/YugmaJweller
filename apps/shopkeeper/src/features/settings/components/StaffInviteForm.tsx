import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, spacing } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';
import { useInviteStaff } from '../hooks/useInviteStaff';
import type { AxiosError } from 'axios';

interface StaffInviteFormProps {
  onSuccess: () => void;
}

export default function StaffInviteForm({ onSuccess }: StaffInviteFormProps): React.ReactElement {
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'shop_staff' | 'shop_manager'>('shop_staff');
  const [duplicateError, setDuplicateError] = useState(false);

  const { mutate, isPending } = useInviteStaff();

  const handleSubmit = (): void => {
    setDuplicateError(false);
    const e164 = phone.startsWith('+91') ? phone : `+91${phone}`;
    mutate(
      { phone: e164, role },
      {
        onSuccess: () => onSuccess(),
        onError: (err) => {
          const axiosErr = err as AxiosError<{ code?: string }>;
          if (axiosErr.response?.status === 409) {
            setDuplicateError(true);
          }
        },
      },
    );
  };

  return (
    <View style={styles.container}>
      {/* Phone input */}
      <View style={styles.phoneRow}>
        <View style={styles.prefix}>
          <Text style={styles.prefixText}>+91</Text>
        </View>
        <TextInput
          style={styles.phoneInput}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={10}
          placeholder="9876543210"
          placeholderTextColor={colors.inkMute}
          accessibilityLabel={t('auth.staff.invite_cta')}
        />
      </View>

      {/* Duplicate error */}
      {duplicateError && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {t('auth.staff.error_duplicate')}
        </Text>
      )}

      {/* Role picker */}
      <View style={styles.roleRow}>
        <TouchableOpacity
          style={[styles.roleBtn, role === 'shop_staff' && styles.roleBtnActive]}
          onPress={() => setRole('shop_staff')}
          accessibilityRole="radio"
          accessibilityState={{ checked: role === 'shop_staff' }}
        >
          <Text style={[styles.roleBtnText, role === 'shop_staff' && styles.roleBtnTextActive]}>
            {t('auth.staff.role_staff')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleBtn, role === 'shop_manager' && styles.roleBtnActive]}
          onPress={() => setRole('shop_manager')}
          accessibilityRole="radio"
          accessibilityState={{ checked: role === 'shop_manager' }}
        >
          <Text style={[styles.roleBtnText, role === 'shop_manager' && styles.roleBtnTextActive]}>
            {t('auth.staff.role_manager')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Submit button */}
      <TouchableOpacity
        style={[styles.submitBtn, isPending && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={isPending || phone.length < 10}
        accessibilityRole="button"
        accessibilityLabel={t('auth.staff.submit')}
      >
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>{t('auth.staff.submit')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const ROLE_BTN_HEIGHT = 48;

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  prefix: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  prefixText: { fontSize: 16, color: colors.ink },
  phoneInput: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    color: colors.ink,
    height: ROLE_BTN_HEIGHT,
  },
  errorText: { fontSize: 14, color: colors.error, marginTop: -spacing.xs },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleBtn: {
    flex: 1,
    height: ROLE_BTN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleBtnText: { fontSize: 16, color: colors.ink },
  roleBtnTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: {
    height: ROLE_BTN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
