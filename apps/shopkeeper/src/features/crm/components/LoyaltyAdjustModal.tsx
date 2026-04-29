import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../../api/client';

type DeltaType = 'add' | 'subtract';

interface Props {
  customerId: string;
  currentBalance: number;
  onSuccess: () => void;
  onClose: () => void;
}

interface AdjustResult {
  pointsDelta: number;
  newBalance: number;
}

export function LoyaltyAdjustModal({ customerId, currentBalance, onSuccess, onClose }: Props): React.ReactElement {
  const [deltaType, setDeltaType] = useState<DeltaType>('add');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation<AdjustResult, Error, void>({
    mutationFn: async () => {
      const raw = parseInt(points, 10);
      if (!raw || raw <= 0) throw new Error('INVALID_POINTS');
      const pointsDelta = deltaType === 'add' ? raw : -raw;
      const res = await api.post<AdjustResult>(
        `/api/v1/loyalty/customers/${customerId}/adjust`,
        { pointsDelta, reason },
      );
      return res.data;
    },
    onSuccess: () => {
      setErrorMsg(null);
      onSuccess();
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'INVALID_POINTS') {
        setErrorMsg('अंक की संख्या सही दर्ज करें');
        return;
      }
      // Axios 422 — negative balance would result
      const axiosErr = err as { response?: { status: number } };
      if (axiosErr?.response?.status === 422) {
        setErrorMsg('बैलेंस नेगेटिव नहीं हो सकता');
      } else {
        setErrorMsg('कुछ गलत हुआ — दोबारा कोशिश करें');
      }
    },
  });

  const reasonValid = reason.trim().length >= 3;
  const pointsValid = /^\d+$/.test(points) && parseInt(points, 10) > 0;
  const canSubmit = pointsValid && reasonValid && !mutation.isPending;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>अंक समायोजित करें</Text>
          <Text style={styles.currentBalance}>मौजूदा बैलेंस: {currentBalance} अंक</Text>

          {/* Type toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, deltaType === 'add' && styles.toggleActive]}
              onPress={() => setDeltaType('add')}
              accessibilityRole="button"
              accessibilityLabel="अंक जोड़ें"
            >
              <Text style={[styles.toggleText, deltaType === 'add' && styles.toggleActiveText]}>
                + अंक जोड़ें
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, deltaType === 'subtract' && styles.toggleActive]}
              onPress={() => setDeltaType('subtract')}
              accessibilityRole="button"
              accessibilityLabel="अंक घटाएं"
            >
              <Text style={[styles.toggleText, deltaType === 'subtract' && styles.toggleActiveText]}>
                − अंक घटाएं
              </Text>
            </TouchableOpacity>
          </View>

          {/* Points input */}
          <Text style={styles.label}>अंक की संख्या</Text>
          <TextInput
            style={styles.input}
            value={points}
            onChangeText={(v) => { setPoints(v); setErrorMsg(null); }}
            keyboardType="number-pad"
            placeholder="जैसे: 50"
            placeholderTextColor="#BBB"
            accessibilityLabel="अंक की संख्या"
            maxLength={7}
          />

          {/* Reason input */}
          <Text style={styles.label}>कारण (ज़रूरी)</Text>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={reason}
            onChangeText={(v) => { setReason(v); setErrorMsg(null); }}
            placeholder="कारण लिखें (कम से कम 3 अक्षर)"
            placeholderTextColor="#BBB"
            multiline
            numberOfLines={3}
            accessibilityLabel="समायोजन का कारण"
            maxLength={500}
          />

          {errorMsg && (
            <Text style={styles.error} accessibilityRole="alert">{errorMsg}</Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="रद्द करें"
            >
              <Text style={styles.cancelText}>रद्द करें</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
              onPress={() => mutation.mutate()}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="सहेजें"
            >
              {mutation.isPending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.submitText}>सहेजें</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFDF7',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  title: {
    fontFamily: 'NotoSansDevanagari_700Bold',
    fontSize: 18,
    color: '#5C3D11',
    marginBottom: 2,
  },
  currentBalance: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 13,
    color: '#888',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D4B896',
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#B8860B',
    borderColor: '#B8860B',
  },
  toggleText: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 14,
    color: '#7A5400',
  },
  toggleActiveText: { color: '#FFF' },
  label: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 13,
    color: '#5C3D11',
    marginBottom: -4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#D4B896',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A1A',
    fontFamily: 'NotoSansDevanagari',
    minHeight: 48,
  },
  reasonInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 13,
    color: '#C62828',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D4B896',
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 15,
    color: '#7A5400',
  },
  submitBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#B8860B',
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  submitDisabled: { backgroundColor: '#CCC' },
  submitText: {
    fontFamily: 'NotoSansDevanagari_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
});
