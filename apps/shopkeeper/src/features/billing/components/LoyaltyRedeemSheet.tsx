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
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import type { LoyaltyState } from '@goldsmith/shared';

interface Props {
  customerId: string;
  onRedeem: (points: number) => void;
  onClose: () => void;
}

export function LoyaltyRedeemSheet({ customerId, onRedeem, onClose }: Props): React.ReactElement {
  const [pointsInput, setPointsInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: loyaltyState, isLoading, isError } = useQuery<LoyaltyState>({
    queryKey: ['loyalty', customerId],
    queryFn: () =>
      api.get<LoyaltyState>(`/api/v1/loyalty/customers/${customerId}`).then((r) => r.data),
    enabled: !!customerId,
  });

  const pointsBalance = loyaltyState?.pointsBalance ?? 0;
  const parsedPoints = parseInt(pointsInput, 10);
  const discountRupees = !Number.isNaN(parsedPoints) && parsedPoints > 0
    ? Math.floor(parsedPoints / 100)
    : 0;

  function handleConfirm(): void {
    const raw = parseInt(pointsInput, 10);
    if (!pointsInput || Number.isNaN(raw) || raw <= 0) {
      setValidationError('कम से कम 1 अंक दर्ज करें');
      return;
    }
    if (raw > pointsBalance) {
      setValidationError(`अधिकतम ${pointsBalance} अंक भुनाए जा सकते हैं`);
      return;
    }
    setValidationError(null);
    onRedeem(raw);
  }

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
          <View style={styles.handle} />
          <Text style={styles.title}>लॉयल्टी पॉइंट भुनाएं</Text>

          {isLoading && (
            <View style={styles.centeredRow}>
              <ActivityIndicator color="#B8860B" size="small" />
              <Text style={styles.loadingText}>लोड हो रहा है...</Text>
            </View>
          )}

          {isError && !isLoading && (
            <Text style={styles.errorText} accessibilityRole="alert">
              जानकारी लोड नहीं हो सकी। पुनः प्रयास करें।
            </Text>
          )}

          {!isLoading && !isError && loyaltyState != null && (
            <>
              <Text style={styles.balanceLabel}>
                उपलब्ध अंक:{' '}
                <Text style={styles.balanceValue}>{pointsBalance}</Text>
              </Text>

              <Text style={styles.label}>कितने अंक भुनाएं?</Text>
              <TextInput
                style={styles.input}
                value={pointsInput}
                onChangeText={(v) => {
                  setPointsInput(v);
                  setValidationError(null);
                }}
                keyboardType="number-pad"
                placeholder={`0 – ${pointsBalance}`}
                placeholderTextColor="#BBB"
                accessibilityLabel="भुनाने के लिए अंक की संख्या"
                maxLength={8}
              />

              {discountRupees > 0 && (
                <Text style={styles.discountHint}>
                  छूट: ₹{discountRupees}
                </Text>
              )}

              {validationError != null && (
                <Text style={styles.errorText} accessibilityRole="alert">
                  {validationError}
                </Text>
              )}
            </>
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
              style={[
                styles.confirmBtn,
                (isLoading || isError || loyaltyState == null) && styles.confirmDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isLoading || isError || loyaltyState == null}
              accessibilityRole="button"
              accessibilityLabel="पॉइंट भुनाएं"
            >
              <Text style={styles.confirmText}>पॉइंट भुनाएं</Text>
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
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D4B896',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'NotoSansDevanagari_700Bold',
    fontSize: 18,
    color: '#5C3D11',
    marginBottom: 2,
  },
  centeredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 14,
    color: '#888',
  },
  balanceLabel: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 14,
    color: '#5C3D11',
  },
  balanceValue: {
    fontFamily: 'NotoSansDevanagari_700Bold',
    color: '#B8860B',
    fontSize: 15,
  },
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
  discountHint: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 13,
    color: '#B8860B',
  },
  errorText: {
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
  confirmBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#B8860B',
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  confirmDisabled: {
    backgroundColor: '#CCC',
  },
  confirmText: {
    fontFamily: 'NotoSansDevanagari_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
});
