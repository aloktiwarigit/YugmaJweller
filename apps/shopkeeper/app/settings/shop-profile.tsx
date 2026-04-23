import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SettingsGroupCard, Toast } from '@goldsmith/ui-mobile';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { api } from '../../src/api/client';
import type { AxiosError } from 'axios';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

interface ShopProfile {
  name: string;
  gstin: string | null;
  bis_registration: string | null;
  contact_phone: string | null;
  about_text: string | null;
  address: { street: string; city: string; state: string; pin_code: string } | null;
}

export default function ShopProfileScreen(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'info' | 'error' } | null>(null);
  const [gstinError, setGstinError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [bisReg, setBisReg] = useState('');
  const [phone, setPhone] = useState('');
  const [aboutText, setAboutText] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [pinCode, setPinCode] = useState('');

  useEffect(() => {
    void api
      .get<ShopProfile>('/api/v1/settings/profile')
      .then((res) => {
        const p = res.data;
        setName(p.name ?? '');
        setGstin(p.gstin ?? '');
        setBisReg(p.bis_registration ?? '');
        setPhone(p.contact_phone?.replace(/^\+91/, '') ?? '');
        setAboutText(p.about_text ?? '');
        setStreet(p.address?.street ?? '');
        setCity(p.address?.city ?? '');
        setAddrState(p.address?.state ?? '');
        setPinCode(p.address?.pin_code ?? '');
      })
      .catch(() => { setLoadFailed(true); })
      .finally(() => setLoading(false));
  }, []);

  function showToast(message: string, variant: 'info' | 'error'): void {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 3000);
  }

  async function saveField(patch: Record<string, unknown>): Promise<void> {
    try {
      await api.patch('/api/v1/settings/profile', patch);
      showToast('बदलाव सहेज लिया ✓', 'info');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const msg = axiosErr.response?.data?.message;
      showToast(typeof msg === 'string' ? msg : 'बदलाव सहेज नहीं हो सका।', 'error');
    }
  }

  function handleNameBlur(): void {
    if (name.trim().length > 0) {
      void saveField({ name: name.trim() });
    }
  }

  function handleGstinBlur(): void {
    const v = gstin.trim().toUpperCase();
    if (v.length === 0) {
      setGstinError(null);
      void saveField({ gstin: null });
      return;
    }
    if (!GSTIN_REGEX.test(v)) {
      setGstinError('GSTIN format सही नहीं है। उदाहरण: 09AAACR5055K1Z5');
      return;
    }
    setGstinError(null);
    void saveField({ gstin: v });
  }

  function handleBisBlur(): void {
    void saveField({ bis_registration: bisReg.trim() || null });
  }

  function handlePhoneBlur(): void {
    const digits = phone.trim().replace(/\D/g, '');
    if (digits.length === 0) {
      void saveField({ contact_phone: null });
      return;
    }
    const formatted =
      digits.startsWith('91') && digits.length === 12
        ? `+${digits}`
        : `+91${digits.slice(-10)}`;
    void saveField({ contact_phone: formatted });
  }

  function handleAboutBlur(): void {
    void saveField({ about_text: aboutText.trim() || null });
  }

  function handleAddressBlur(): void {
    if (
      street.trim() &&
      city.trim() &&
      addrState.trim() &&
      /^\d{6}$/.test(pinCode.trim())
    ) {
      void saveField({
        address: {
          street: street.trim(),
          city: city.trim(),
          state: addrState.trim(),
          pin_code: pinCode.trim(),
        },
      });
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (loadFailed) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>प्रोफ़ाइल लोड नहीं हो सकी।</Text>
        <Text style={styles.retryHint}>वापस जाएं और दोबारा कोशिश करें।</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {toast !== null && (
          <View style={styles.toastWrapper}>
            <Toast message={toast.message} variant={toast.variant} />
          </View>
        )}

        <SettingsGroupCard title="दुकान की जानकारी">
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>दुकान का नाम</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              onBlur={handleNameBlur}
              placeholder="जैसे: राजेश ज्वेलर्स"
              returnKeyType="next"
              accessibilityLabel="दुकान का नाम"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>फ़ोन</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              onBlur={handlePhoneBlur}
              placeholder="10 अंक का मोबाइल नंबर"
              keyboardType="phone-pad"
              accessibilityLabel="फ़ोन नंबर"
            />
          </View>

          <View style={[styles.fieldGroup, styles.lastField]}>
            <Text style={styles.label}>हमारे बारे में</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={aboutText}
              onChangeText={(v) => setAboutText(v.slice(0, 500))}
              onBlur={handleAboutBlur}
              placeholder="दुकान के बारे में लिखें (500 अक्षर तक)"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel="हमारे बारे में"
            />
            <Text style={styles.charCount}>{aboutText.length}/500</Text>
          </View>
        </SettingsGroupCard>

        <SettingsGroupCard title="पता">
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>गली/मोहल्ला</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={street}
              onChangeText={setStreet}
              onBlur={handleAddressBlur}
              placeholder="जैसे: मेन मार्केट, सिविल लाइंस"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              accessibilityLabel="गली या मोहल्ला"
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>शहर</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              onBlur={handleAddressBlur}
              placeholder="जैसे: अयोध्या"
              accessibilityLabel="शहर"
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>राज्य</Text>
            <TextInput
              style={styles.input}
              value={addrState}
              onChangeText={setAddrState}
              onBlur={handleAddressBlur}
              placeholder="जैसे: उत्तर प्रदेश"
              accessibilityLabel="राज्य"
            />
          </View>
          <View style={[styles.fieldGroup, styles.lastField]}>
            <Text style={styles.label}>पिन कोड</Text>
            <TextInput
              style={styles.input}
              value={pinCode}
              onChangeText={setPinCode}
              onBlur={handleAddressBlur}
              placeholder="6 अंकों का पिन"
              keyboardType="numeric"
              maxLength={6}
              accessibilityLabel="पिन कोड"
            />
          </View>
        </SettingsGroupCard>

        <SettingsGroupCard title="कानूनी जानकारी">
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>GSTIN</Text>
            <TextInput
              style={[styles.input, gstinError !== null ? styles.inputError : null]}
              value={gstin}
              onChangeText={(v) => {
                setGstin(v);
                setGstinError(null);
              }}
              onBlur={handleGstinBlur}
              placeholder="जैसे: 09AAACR5055K1Z5"
              autoCapitalize="characters"
              accessibilityLabel="GSTIN"
            />
            {gstinError !== null && (
              <Text style={styles.inputErrorText} accessibilityLiveRegion="polite">
                {gstinError}
              </Text>
            )}
          </View>

          <View style={[styles.fieldGroup, styles.lastField]}>
            <Text style={styles.label}>BIS Registration</Text>
            <TextInput
              style={styles.input}
              value={bisReg}
              onChangeText={setBisReg}
              onBlur={handleBisBlur}
              placeholder="BIS लाइसेंस नंबर (अगर हो)"
              accessibilityLabel="BIS Registration नंबर"
            />
          </View>
        </SettingsGroupCard>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg },
  contentContainer: { paddingTop: spacing.sm, paddingBottom: spacing.xl },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  toastWrapper: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  fieldGroup: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  lastField: {
    marginBottom: 0,
    paddingBottom: spacing.md,
  },
  label: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 6,
    marginTop: spacing.sm,
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
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: { borderColor: colors.error },
  inputErrorText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.error,
    marginTop: 4,
  },
  charCount: {
    fontFamily: typography.body.family,
    fontSize: 12,
    color: colors.inkMute,
    textAlign: 'right',
    marginTop: 4,
  },
  errorText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryHint: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.inkMute,
    textAlign: 'center',
  },
});
