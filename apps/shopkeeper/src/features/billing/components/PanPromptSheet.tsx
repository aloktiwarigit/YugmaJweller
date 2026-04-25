import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  Animated,
  ScrollView,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';

// PAN format: 5 uppercase alpha + 4 digits + 1 uppercase alpha
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export interface Form60Data {
  name: string;
  address: string;
  reasonForNoPan: string;
  estimatedAnnualIncomePaise: string;
}

export interface PanSubmitPayload {
  pan?: string;
  form60Data?: Form60Data;
}

interface Props {
  visible: boolean;
  totalPaise: bigint;
  onSubmit: (payload: PanSubmitPayload) => void;
  onCancel: () => void;
}

function formatRupees(paise: bigint): string {
  const rupees = Number(paise) / 100;
  return `₹${rupees.toLocaleString('hi-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Tab = 'pan' | 'form60';

export function PanPromptSheet({ visible, totalPaise, onSubmit, onCancel }: Props): JSX.Element {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [tab, setTab] = useState<Tab>('pan');
  const [pan, setPan] = useState('');
  const [panError, setPanError] = useState<string | null>(null);
  const [f60Name, setF60Name] = useState('');
  const [f60Address, setF60Address] = useState('');
  const [f60Reason, setF60Reason] = useState('');
  const [f60Income, setF60Income] = useState('');

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    } else {
      slideAnim.setValue(400);
      setPan('');
      setPanError(null);
      setTab('pan');
      setF60Name('');
      setF60Address('');
      setF60Reason('');
      setF60Income('');
    }
  }, [visible, slideAnim]);

  const handlePanChange = useCallback((text: string) => {
    const normalized = text.toUpperCase().replace(/\s+/g, '');
    setPan(normalized);
    if (normalized.length === 10) {
      setPanError(PAN_RE.test(normalized) ? null : 'PAN format सही नहीं — जैसे: ABCDE1234F');
    } else {
      setPanError(null);
    }
  }, []);

  const handleSubmitPan = useCallback(() => {
    const normalized = pan.toUpperCase().trim();
    if (!PAN_RE.test(normalized)) {
      setPanError('PAN format सही नहीं — जैसे: ABCDE1234F');
      AccessibilityInfo.announceForAccessibility('PAN format सही नहीं');
      return;
    }
    onSubmit({ pan: normalized });
  }, [pan, onSubmit]);

  const handleSubmitForm60 = useCallback(() => {
    if (!f60Name.trim() || !f60Address.trim() || !f60Reason.trim() || !f60Income.trim()) {
      AccessibilityInfo.announceForAccessibility('सभी फ़ील्ड ज़रूरी हैं');
      return;
    }
    const incomePaise = f60Income.replace(/[^0-9]/g, '');
    onSubmit({
      form60Data: {
        name: f60Name.trim(),
        address: f60Address.trim(),
        reasonForNoPan: f60Reason.trim(),
        estimatedAnnualIncomePaise: incomePaise || '0',
      },
    });
  }, [f60Name, f60Address, f60Reason, f60Income, onSubmit]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="रद्द करें" />
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        accessibilityRole="dialog"
        accessibilityLabel="PAN या Form 60 ज़रूरी है"
      >
        <View style={styles.handle} />

        <Text style={styles.heading}>PAN या Form 60 ज़रूरी है</Text>
        <Text style={styles.totalLine}>
          कुल बिल: <Text style={styles.totalAmount}>{formatRupees(totalPaise)}</Text>
        </Text>
        <Text style={styles.subtext}>
          ₹2,00,000 से अधिक के bill पर PAN या Form 60 आवश्यक है (Rule 114B)।
        </Text>

        {/* Tab selector */}
        <View style={styles.tabRow} accessibilityRole="tablist">
          <Pressable
            style={[styles.tabBtn, tab === 'pan' && styles.tabBtnActive]}
            onPress={() => setTab('pan')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'pan' }}
          >
            <Text style={[styles.tabText, tab === 'pan' && styles.tabTextActive]}>
              PAN दर्ज करें
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === 'form60' && styles.tabBtnActive]}
            onPress={() => setTab('form60')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'form60' }}
          >
            <Text style={[styles.tabText, tab === 'form60' && styles.tabTextActive]}>
              Form 60 भरें
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
          {tab === 'pan' ? (
            <View>
              <Text style={styles.fieldLabel}>PAN नंबर</Text>
              <TextInput
                value={pan}
                onChangeText={handlePanChange}
                style={[styles.input, panError ? styles.inputError : null]}
                placeholder="ABCDE1234F"
                autoCapitalize="characters"
                maxLength={10}
                keyboardType="default"
                accessibilityLabel="PAN नंबर"
                accessibilityHint="10 अक्षर — 5 अक्षर, 4 अंक, 1 अक्षर"
              />
              {panError ? (
                <Text style={styles.errorText} accessibilityRole="alert">
                  {panError}
                </Text>
              ) : null}

              <Pressable
                onPress={handleSubmitPan}
                style={styles.submitBtn}
                accessibilityRole="button"
              >
                <Text style={styles.submitBtnText}>PAN ज़मा करें</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.fieldLabel}>नाम *</Text>
              <TextInput
                value={f60Name}
                onChangeText={setF60Name}
                style={styles.input}
                placeholder="ग्राहक का पूरा नाम"
                accessibilityLabel="ग्राहक का नाम"
              />

              <Text style={styles.fieldLabel}>पता *</Text>
              <TextInput
                value={f60Address}
                onChangeText={setF60Address}
                style={[styles.input, styles.inputMultiline]}
                placeholder="पूरा पता"
                multiline
                numberOfLines={3}
                accessibilityLabel="पूरा पता"
              />

              <Text style={styles.fieldLabel}>PAN न होने का कारण *</Text>
              <TextInput
                value={f60Reason}
                onChangeText={setF60Reason}
                style={styles.input}
                placeholder="जैसे: PAN card नहीं बना है"
                accessibilityLabel="PAN न होने का कारण"
              />

              <Text style={styles.fieldLabel}>अनुमानित वार्षिक आय (₹) *</Text>
              <TextInput
                value={f60Income}
                onChangeText={setF60Income}
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                accessibilityLabel="अनुमानित वार्षिक आय रुपये में"
              />

              <Pressable
                onPress={handleSubmitForm60}
                style={styles.submitBtn}
                accessibilityRole="button"
              >
                <Text style={styles.submitBtnText}>Form 60 ज़मा करें</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <Pressable onPress={onCancel} style={styles.cancelBtn} accessibilityRole="button">
          <Text style={styles.cancelText}>रद्द करें</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fdf6ec',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#d6d3d1',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'NotoSansDevanagari',
    color: '#1c1917',
    marginBottom: 6,
  },
  totalLine: {
    fontSize: 16,
    fontFamily: 'NotoSansDevanagari',
    color: '#44403c',
    marginBottom: 4,
  },
  totalAmount: {
    fontWeight: '700',
    color: '#92400e',
    fontSize: 18,
  },
  subtext: {
    fontSize: 13,
    fontFamily: 'NotoSansDevanagari',
    color: '#78716c',
    marginBottom: 16,
    lineHeight: 18,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    marginBottom: 16,
    overflow: 'hidden',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    minHeight: 48,
  },
  tabBtnActive: {
    backgroundColor: '#92400e',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'NotoSansDevanagari',
    color: '#78716c',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  tabContent: {
    flexGrow: 0,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'NotoSansDevanagari',
    color: '#44403c',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    minHeight: 48,
    color: '#1c1917',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontFamily: 'NotoSansDevanagari',
    marginTop: -8,
    marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: '#92400e',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
    minHeight: 48,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'NotoSansDevanagari',
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  cancelText: {
    color: '#78716c',
    fontSize: 16,
    fontFamily: 'NotoSansDevanagari',
  },
});
