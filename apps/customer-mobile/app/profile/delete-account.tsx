// apps/customer-mobile/app/profile/delete-account.tsx
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radii, spacing, typography } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { customerSelfDelete, type TypedApiError } from '../../src/api/endpoints';

const CONFIRM_PHRASE = 'मेरा डेटा मिटाएँ';

type Reason = 'no-need' | 'privacy' | 'other-jeweller' | 'other';

const REASON_OPTIONS: Array<{ value: Reason; label: string }> = [
  { value: 'no-need',        label: 'मुझे ज़रूरत नहीं' },
  { value: 'privacy',        label: 'गोपनीयता की चिंता' },
  { value: 'other-jeweller', label: 'दूसरे जौहरी से खरीद रहा' },
  { value: 'other',          label: 'अन्य' },
];

function errorMessage(error: unknown): string {
  const code = (error as Partial<TypedApiError> | undefined)?.code;
  switch (code) {
    case 'crm.deletion.open_invoices':
      return 'खुले बिल होने के कारण अभी हटाने का अनुरोध नहीं हो सकता। कृपया दुकान से संपर्क करें।';
    case 'crm.deletion.already_requested':
      return 'हटाने का अनुरोध पहले से चल रहा है। कृपया लॉग आउट करके बाद में देखें।';
    case 'crm.deletion.try_at_home_in_flight':
      return 'घर पर ट्राय का सामान अभी आपके पास है — पहले लौटाएँ।';
    default:
      return 'हटाने का अनुरोध नहीं हो सका। कृपया फिर कोशिश करें या दुकान से संपर्क करें।';
  }
}

export default function DeleteAccountScreen(): React.ReactElement {
  const router = useRouter();
  const { signOut } = useCustomerSession();

  const [reason, setReason]         = useState<Reason | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [confirm, setConfirm]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const canSubmit = useMemo(
    () => reason !== null && confirm === CONFIRM_PHRASE && !submitting,
    [reason, confirm, submitting],
  );

  const onSubmit = async (): Promise<void> => {
    if (!canSubmit || reason === null) return;
    setSubmitting(true);
    setError(null);
    try {
      await customerSelfDelete({
        reason,
        reasonText: reason === 'other' && reasonText.trim().length > 0 ? reasonText.trim() : undefined,
      });
      await signOut();
      router.replace('/profile/delete-account-done' as any);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="वापस"
          style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: spacing.md }}
        >
          <Text style={{ fontFamily: typography.body.family, color: colors.inkMute, fontSize: 14 }}>वापस</Text>
        </Pressable>

        <Text
          accessibilityRole="header"
          style={{ fontFamily: typography.display.family, fontSize: 24, color: colors.ink, marginBottom: spacing.sm }}
        >
          क्या आप वाक़ई अपना खाता हटाना चाहते हैं?
        </Text>
        <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.inkMute, marginBottom: spacing.md, lineHeight: 22 }}>
          हटाने के बाद आपका नाम, फ़ोन, पता, PAN और अन्य व्यक्तिगत जानकारी तुरंत मिटा दी जाएगी। पुराने बिल कर अनुपालन के लिए
          सुरक्षित रहेंगे, पर वे आपके नाम से जुड़े नहीं रहेंगे। यह कार्य पलटा नहीं जा सकता।
        </Text>

        <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.ink, marginBottom: spacing.xs, fontWeight: '600' }}>
          हटाने का कारण
        </Text>
        <View accessibilityRole="radiogroup" style={{ marginBottom: spacing.md }}>
          {REASON_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              testID={`delete-account-reason-${opt.value}`}
              onPress={() => setReason(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: reason === opt.value }}
              style={{
                flexDirection:   'row',
                alignItems:      'center',
                paddingVertical: spacing.sm,
                minHeight:       48,
              }}
            >
              <View
                style={{
                  width:          20,
                  height:         20,
                  borderRadius:   10,
                  borderWidth:    2,
                  borderColor:    reason === opt.value ? colors.primary : colors.border,
                  marginRight:    spacing.sm,
                  alignItems:     'center',
                  justifyContent: 'center',
                }}
              >
                {reason === opt.value && (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
                )}
              </View>
              <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: colors.ink }}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        {reason === 'other' && (
          <TextInput
            testID="delete-account-reason-text"
            value={reasonText}
            onChangeText={setReasonText}
            maxLength={200}
            placeholder="कृपया कारण लिखें"
            placeholderTextColor={colors.inkMute}
            style={{
              borderWidth:  1,
              borderColor:  colors.border,
              borderRadius: radii.md,
              padding:      spacing.sm,
              minHeight:    48,
              fontFamily:   typography.body.family,
              fontSize:     15,
              color:        colors.ink,
              marginBottom: spacing.md,
            }}
          />
        )}

        <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.ink, marginBottom: spacing.xs, fontWeight: '600' }}>
          पुष्टि के लिए नीचे टाइप करें: <Text style={{ color: '#8C2A1E' }}>{CONFIRM_PHRASE}</Text>
        </Text>
        <TextInput
          testID="delete-account-confirm-input"
          value={confirm}
          onChangeText={setConfirm}
          autoCorrect={false}
          autoCapitalize="none"
          placeholder={CONFIRM_PHRASE}
          placeholderTextColor={colors.inkMute}
          style={{
            borderWidth:  1,
            borderColor:  colors.border,
            borderRadius: radii.md,
            padding:      spacing.sm,
            minHeight:    48,
            fontFamily:   typography.body.family,
            fontSize:     16,
            color:        colors.ink,
            marginBottom: spacing.md,
          }}
        />

        {error !== null && (
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: '#8C2A1E', marginBottom: spacing.sm }}>
            {error}
          </Text>
        )}

        <Pressable
          testID="delete-account-submit"
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          accessibilityLabel="खाता हटाएँ"
          style={{
            backgroundColor: canSubmit ? '#8C2A1E' : colors.border,
            borderRadius:    radii.md,
            paddingVertical: spacing.md,
            minHeight:       48,
            justifyContent:  'center',
            alignItems:      'center',
            opacity:         canSubmit ? 1 : 0.6,
          }}
        >
          <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: colors.white, fontWeight: '600' }}>
            {submitting ? 'हटाया जा रहा है...' : 'हाँ, मेरा खाता हटाएँ'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
