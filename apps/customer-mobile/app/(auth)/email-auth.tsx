import React, { useState } from 'react';
import {
  Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, View,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

type Tab = 'signin' | 'signup';

const HINDI_ERRORS: Record<string, string> = {
  'auth/invalid-credential':   'ईमेल या पासवर्ड गलत है।',
  'auth/user-not-found':       'ईमेल या पासवर्ड गलत है।',
  'auth/wrong-password':       'ईमेल या पासवर्ड गलत है।',
  'auth/email-already-in-use': 'यह ईमेल पहले से पंजीकृत है। साइन इन करें।',
  'auth/weak-password':        'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।',
  'auth/invalid-email':        'अमान्य ईमेल पता।',
  'auth/too-many-requests':    'बहुत अधिक प्रयास। कुछ देर बाद पुनः प्रयास करें।',
};

function mapError(code: string): string {
  return HINDI_ERRORS[code] ?? 'एक त्रुटि हुई। पुनः प्रयास करें।';
}

export default function EmailAuth(): React.ReactElement {
  const [tab,         setTab]         = useState<Tab>('signin');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [resetSent,   setResetSent]   = useState(false);

  const validate = (): string | null => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return 'वैध ईमेल पता दर्ज करें।';
    if (password.length < 8)
      return 'पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।';
    if (tab === 'signup') {
      if (!displayName.trim()) return 'अपना नाम दर्ज करें।';
      if (password !== confirmPass) return 'पासवर्ड मेल नहीं खाते।';
    }
    return null;
  };

  const onSignIn = async (): Promise<void> => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      await auth().signInWithEmailAndPassword(email.trim(), password);
      // CustomerAuthProvider handles session via onAuthStateChanged
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(mapError(code));
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async (): Promise<void> => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      const cred = await auth().createUserWithEmailAndPassword(email.trim(), password);
      await cred.user.updateProfile({ displayName: displayName.trim() });
      // Force token refresh so displayName is in the next token claim
      await cred.user.getIdToken(true);
      // CustomerAuthProvider handles session via onAuthStateChanged
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(mapError(code));
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async (): Promise<void> => {
    if (!email.trim()) { setError('पासवर्ड रीसेट के लिए पहले ईमेल दर्ज करें।'); return; }
    setError(null);
    setLoading(true);
    try {
      await auth().sendPasswordResetEmail(email.trim());
      setResetSent(true);
    } catch {
      setError('पासवर्ड रीसेट ईमेल नहीं भेज पाए। पुनः प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (hasError?: boolean): object => ({
    borderWidth:       1.5,
    borderColor:       hasError ? '#DC2626' : colors.border,
    borderRadius:      radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    fontSize:          16,
    fontFamily:        typography.body.family,
    color:             colors.ink,
    backgroundColor:   colors.white,
    minHeight:         52,
    marginBottom:      spacing.sm,
  });

  const primaryBtn = {
    backgroundColor: colors.ink,
    borderRadius:    radii.sm,
    paddingVertical: spacing.md,
    alignItems:      'center' as const,
    minHeight:       52,
    justifyContent:  'center' as const,
    marginTop:       spacing.sm,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tab switcher */}
        <View style={{ flexDirection: 'row', marginBottom: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {(['signin', 'signup'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => { setTab(t); setError(null); setResetSent(false); }}
              style={{ flex: 1, paddingBottom: spacing.sm, borderBottomWidth: 2, borderBottomColor: tab === t ? colors.ink : 'transparent' }}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
            >
              <Text style={{ textAlign: 'center', fontFamily: typography.body.family, fontSize: 16, color: tab === t ? colors.ink : colors.inkMute, fontWeight: tab === t ? '700' : '400' }}>
                {t === 'signin' ? 'साइन इन' : 'खाता बनाएं'}
              </Text>
            </Pressable>
          ))}
        </View>

        {resetSent ? (
          <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: '#15803D', textAlign: 'center', marginBottom: spacing.lg }} accessibilityRole="alert">
            पासवर्ड रीसेट का ईमेल भेज दिया गया। अपना इनबॉक्स जाँचें।
          </Text>
        ) : null}

        {tab === 'signup' && (
          <TextInput
            testID="displayname-input"
            value={displayName}
            onChangeText={(v) => { setDisplayName(v); setError(null); }}
            placeholder="आपका नाम"
            placeholderTextColor={colors.inkMute}
            style={inputStyle()}
            accessibilityLabel="नाम"
          />
        )}

        <TextInput
          testID="email-input"
          value={email}
          onChangeText={(v) => { setEmail(v); setError(null); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="ईमेल पता"
          placeholderTextColor={colors.inkMute}
          style={inputStyle()}
          accessibilityLabel="ईमेल"
        />

        <View style={{ position: 'relative' }}>
          <TextInput
            testID="password-input"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            secureTextEntry={!showPass}
            placeholder="पासवर्ड (8+ अक्षर)"
            placeholderTextColor={colors.inkMute}
            style={inputStyle()}
            accessibilityLabel="पासवर्ड"
          />
          <Pressable
            onPress={() => setShowPass((p) => !p)}
            style={{ position: 'absolute', right: spacing.md, top: 14 }}
            accessibilityRole="button"
            accessibilityLabel={showPass ? 'पासवर्ड छुपाएं' : 'पासवर्ड दिखाएं'}
          >
            <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute }}>
              {showPass ? 'छुपाएं' : 'दिखाएं'}
            </Text>
          </Pressable>
        </View>

        {tab === 'signup' && (
          <TextInput
            testID="confirm-password-input"
            value={confirmPass}
            onChangeText={(v) => { setConfirmPass(v); setError(null); }}
            secureTextEntry={!showPass}
            placeholder="पासवर्ड पुनः दर्ज करें"
            placeholderTextColor={colors.inkMute}
            style={inputStyle(!!error && password !== confirmPass)}
            accessibilityLabel="पासवर्ड पुनः दर्ज करें"
          />
        )}

        {error ? (
          <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#DC2626', marginBottom: spacing.sm }} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          testID={tab === 'signin' ? 'signin-button' : 'signup-button'}
          onPress={() => { void (tab === 'signin' ? onSignIn() : onSignUp()); }}
          disabled={loading}
          style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}
          accessibilityRole="button"
        >
          {loading ? <ActivityIndicator color={colors.white} /> : (
            <Text style={{ fontFamily: typography.body.family, fontSize: 17, color: colors.white, fontWeight: '700' }}>
              {tab === 'signin' ? 'साइन इन' : 'खाता बनाएं'}
            </Text>
          )}
        </Pressable>

        {tab === 'signin' && (
          <Pressable
            testID="forgot-password-button"
            onPress={() => { void onForgotPassword(); }}
            disabled={loading}
            style={{ marginTop: spacing.md, alignItems: 'center' }}
            accessibilityRole="button"
          >
            <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.accent }}>
              पासवर्ड भूल गए?
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
