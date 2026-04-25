import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  Animated,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';

const LIMIT_RUPEES = 1_99_999;

function paiseToRupees(paise: bigint): string {
  const r = Number(paise) / 100;
  return new Intl.NumberFormat('hi-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(r);
}

export interface CashCapBlockPayload {
  splitMethod: 'UPI' | 'CARD';
  // Amount that must go via the non-cash method (requestedPaise - allowedCashPaise)
  nonCashAmountPaise: bigint;
}

export interface CashCapOverridePayload {
  justification: string;
}

export interface CashCapBlockModalProps {
  visible:        boolean;
  requestedPaise: bigint;      // amount the customer wants to pay in cash
  remainingPaise: bigint;      // how much cash is still allowed today
  userRole:       'shop_admin' | 'shop_manager' | 'shop_staff';
  onSplitMethod:  (payload: CashCapBlockPayload) => void;
  onOverride:     (payload: CashCapOverridePayload) => void;
  onDismiss:      () => void;
}

export function CashCapBlockModal({
  visible,
  requestedPaise,
  remainingPaise,
  userRole,
  onSplitMethod,
  onOverride,
  onDismiss,
}: CashCapBlockModalProps) {
  const [justification, setJustification] = useState('');
  const [showOverride, setShowOverride]   = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const canOverride = userRole === 'shop_admin' || userRole === 'shop_manager';

  useEffect(() => {
    if (visible) {
      setJustification('');
      setShowOverride(false);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible, slideAnim]);

  useEffect(() => {
    if (visible) {
      AccessibilityInfo.announceForAccessibility('आज की cash limit पूरी हो गई है');
    }
  }, [visible]);

  const handleOverrideSubmit = useCallback(() => {
    const trimmed = justification.trim();
    if (trimmed.length < 10) return;
    onOverride({ justification: trimmed });
  }, [justification, onOverride]);

  const allowedCashPaise = remainingPaise > 0n ? remainingPaise : 0n;
  // Amount that must go via a non-cash method when split
  const nonCashAmountPaise = requestedPaise > allowedCashPaise
    ? requestedPaise - allowedCashPaise
    : 0n;

  const splitCashStr  = paiseToRupees(allowedCashPaise);
  const requestedStr  = paiseToRupees(requestedPaise);
  const limitStr      = paiseToRupees(BigInt(LIMIT_RUPEES * 100));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="बंद करें" />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.pill} />
            <Text style={styles.titleText} accessibilityRole="header">
              आज की cash limit पूरी
            </Text>
            <Text style={styles.limitBadge}>{limitStr}</Text>
          </View>

          {/* Amount info */}
          <View style={styles.infoRow}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>ग्राहक भुगतान करना चाहता है</Text>
              <Text style={styles.infoAmount}>{requestedStr}</Text>
            </View>
            <View style={[styles.infoBox, styles.infoBoxRight]}>
              <Text style={styles.infoLabel}>आज cash की गुंजाइश</Text>
              <Text style={[styles.infoAmount, remainingPaise <= 0n && styles.zeroAmount]}>
                {remainingPaise > 0n ? splitCashStr : '₹0'}
              </Text>
            </View>
          </View>

          {/* Quick-action split buttons */}
          {remainingPaise > 0n && (
            <View style={styles.splitSection}>
              <Text style={styles.sectionLabel}>बाकी {paiseToRupees(nonCashAmountPaise)} इससे लें:</Text>
              <View style={styles.splitRow}>
                <Pressable
                  style={[styles.splitBtn, styles.splitUpi]}
                  onPress={() => onSplitMethod({ splitMethod: 'UPI', nonCashAmountPaise })}
                  accessibilityLabel={`UPI से बाकी राशि लें`}
                  accessibilityRole="button"
                >
                  <Text style={styles.splitBtnText}>UPI से बाकी लें</Text>
                </Pressable>
                <Pressable
                  style={[styles.splitBtn, styles.splitCard]}
                  onPress={() => onSplitMethod({ splitMethod: 'CARD', nonCashAmountPaise })}
                  accessibilityLabel={`Card से बाकी राशि लें`}
                  accessibilityRole="button"
                >
                  <Text style={styles.splitBtnText}>Card से बाकी लें</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Override section */}
          <View style={styles.overrideSection}>
            {canOverride ? (
              <>
                <Pressable
                  style={styles.overrideToggle}
                  onPress={() => setShowOverride((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel="Override करें"
                >
                  <Text style={styles.overrideToggleText}>
                    {showOverride ? '▲ Override छुपाएं' : '▼ Override (Owner/Manager)'}
                  </Text>
                </Pressable>

                {showOverride && (
                  <View style={styles.overrideForm}>
                    <Text style={styles.overrideHint}>
                      Cash limit से ज़्यादा लेने का कारण लिखें (कम से कम 10 अक्षर)
                    </Text>
                    <TextInput
                      style={styles.overrideInput}
                      value={justification}
                      onChangeText={setJustification}
                      placeholder="कारण लिखें…"
                      placeholderTextColor="#9CA3AF"
                      multiline
                      maxLength={1000}
                      accessibilityLabel="Override कारण"
                      accessibilityHint="Override के लिए कम से कम 10 अक्षर लिखें"
                    />
                    <Pressable
                      style={[
                        styles.overrideSubmit,
                        justification.trim().length < 10 && styles.overrideSubmitDisabled,
                      ]}
                      onPress={handleOverrideSubmit}
                      disabled={justification.trim().length < 10}
                      accessibilityRole="button"
                      accessibilityLabel="Override करके save करें"
                      accessibilityState={{ disabled: justification.trim().length < 10 }}
                    >
                      <Text style={styles.overrideSubmitText}>Override करके भुगतान लें</Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.staffNote} accessibilityRole="text">
                केवल owner/manager override कर सकते हैं
              </Text>
            )}
          </View>

          {/* Dismiss */}
          <Pressable style={styles.dismissBtn} onPress={onDismiss} accessibilityRole="button">
            <Text style={styles.dismissText}>रद्द करें</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#FFFBF5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  pill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1C4A8',
    marginBottom: 12,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#991B1B',
    fontFamily: 'NotoSansDevanagari-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  limitBadge: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'NotoSansDevanagari-Regular',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  infoBox: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
  },
  infoBoxRight: {
    backgroundColor: '#DCFCE7',
  },
  infoLabel: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'NotoSansDevanagari-Regular',
    marginBottom: 4,
  },
  infoAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    fontFamily: 'NotoSansDevanagari-Bold',
  },
  zeroAmount: {
    color: '#DC2626',
  },
  splitSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'NotoSansDevanagari-Regular',
    marginBottom: 8,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  splitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
  },
  splitUpi: {
    backgroundColor: '#7C3AED',
  },
  splitCard: {
    backgroundColor: '#1D4ED8',
  },
  splitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'NotoSansDevanagari-SemiBold',
  },
  overrideSection: {
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  overrideToggle: {
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  overrideToggleText: {
    fontSize: 14,
    color: '#B45309',
    fontFamily: 'NotoSansDevanagari-Regular',
    textDecorationLine: 'underline',
  },
  overrideForm: {
    marginTop: 8,
  },
  overrideHint: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'NotoSansDevanagari-Regular',
    marginBottom: 8,
  },
  overrideInput: {
    borderWidth: 1,
    borderColor: '#D1C4A8',
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    fontFamily: 'NotoSansDevanagari-Regular',
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  overrideSubmit: {
    backgroundColor: '#92400E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  overrideSubmitDisabled: {
    backgroundColor: '#D1C4A8',
  },
  overrideSubmitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'NotoSansDevanagari-SemiBold',
  },
  staffNote: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: 'NotoSansDevanagari-Regular',
    textAlign: 'center',
    paddingVertical: 8,
  },
  dismissBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  dismissText: {
    fontSize: 15,
    color: '#6B7280',
    fontFamily: 'NotoSansDevanagari-Regular',
  },
});
