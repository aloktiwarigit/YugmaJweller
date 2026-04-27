import React, { useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import type { DeletionRequestResponse } from '@goldsmith/shared';

interface Props {
  visible:        boolean;
  customerId:     string;
  customerName:   string;
  onClose:        () => void;
  onConfirmed:    (response: DeletionRequestResponse) => void;
  onRequestDelete: (
    customerId: string,
    confirmationName: string,
    requestedBy: 'customer' | 'owner',
  ) => Promise<DeletionRequestResponse>;
}

// Story 6.8 — DPDPA-compliant deletion confirmation sheet.
// OWNER (shop_admin) only. The OWNER must type the customer's name back to
// confirm the right row is being deleted; this is a soft fence (server-side
// re-checks) but it dramatically reduces fat-finger mistakes.
export function DeletionRequestSheet({
  visible, customerId, customerName, onClose, onConfirmed, onRequestDelete,
}: Props): React.ReactElement {
  const [confirmationText, setConfirmationText] = useState('');
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState<string | null>(null);

  const trimmedTarget       = customerName.trim();
  const trimmedConfirmation = confirmationText.trim();
  const namesMatch          = trimmedConfirmation.length > 0 && trimmedConfirmation === trimmedTarget;

  function reset(): void {
    setConfirmationText('');
    setSubmitting(false);
    setError(null);
  }

  function handleClose(): void {
    if (submitting) return;
    reset();
    onClose();
  }

  async function handleSubmit(): Promise<void> {
    if (!namesMatch || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await onRequestDelete(customerId, trimmedConfirmation, 'owner');
      onConfirmed(response);
      reset();
    } catch (err: unknown) {
      const code = (err as { code?: string; response?: { code?: string } }).response?.code
        ?? (err as { code?: string }).code;
      if (code === 'crm.deletion.open_invoices') {
        setError('इस ग्राहक के लंबित Draft invoice हैं। पहले उन्हें issue या void करें।');
      } else if (code === 'crm.deletion.already_requested') {
        setError('इस ग्राहक के लिए हटाने का अनुरोध पहले से दर्ज है।');
      } else if (code === 'crm.deletion.confirmation_mismatch') {
        setError('नाम मेल नहीं खाया। कृपया पूर्ण नाम वैसे ही टाइप करें जैसा रिकॉर्ड में है।');
      } else {
        setError('हटाने का अनुरोध दर्ज नहीं हो सका। कुछ समय बाद पुनः प्रयास करें।');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollInner}>
            <Text style={styles.title}>ग्राहक का डेटा हटाएं?</Text>
            <View style={styles.targetRow}>
              <Text style={styles.targetLabel}>ग्राहक:</Text>
              <Text style={styles.targetName}>{customerName}</Text>
            </View>

            <View style={styles.warningCard}>
              <Text style={styles.warningHeading}>⚠️ कृपया ध्यान से पढ़ें</Text>
              <Text style={styles.warningLine}>• ग्राहक का व्यक्तिगत डेटा अभी हटाया जाएगा।</Text>
              <Text style={styles.warningLine}>• 30 दिन बाद खाता पूरी तरह बंद हो जाएगा।</Text>
              <Text style={styles.warningLine}>• Invoice, HUID, और tax records कानूनी रूप से 5 साल तक रहेंगे (DPDPA + PMLA)।</Text>
              <Text style={styles.warningLineDanger}>• यह कार्य अपरिवर्तनीय है — PII वापस नहीं लाई जा सकती।</Text>
            </View>

            <Text style={styles.confirmHint}>
              पुष्टि के लिए, ग्राहक का पूर्ण नाम वैसे ही टाइप करें जैसा रिकॉर्ड में है:
            </Text>
            <Text style={styles.targetNameLarge}>{customerName}</Text>

            <TextInput
              testID="deletion-confirmation-input"
              style={styles.input}
              value={confirmationText}
              onChangeText={setConfirmationText}
              placeholder="यहाँ ग्राहक का नाम टाइप करें"
              autoCorrect={false}
              autoCapitalize="words"
              accessibilityLabel="ग्राहक के नाम की पुष्टि"
            />

            {error && (
              <View style={styles.errorBox} accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              testID="deletion-cancel-btn"
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="रद्द करें"
            >
              <Text style={styles.cancelBtnText}>रद्द करें</Text>
            </Pressable>
            <Pressable
              testID="deletion-confirm-btn"
              style={[styles.confirmBtn, (!namesMatch || submitting) && styles.confirmBtnDisabled]}
              onPress={() => void handleSubmit()}
              disabled={!namesMatch || submitting}
              accessibilityRole="button"
              accessibilityLabel="हटाने का अनुरोध करें"
              accessibilityState={{ disabled: !namesMatch || submitting }}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.confirmBtnText}>हटाने का अनुरोध करें</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 12, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFBF2',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    paddingBottom: 16,
  },
  scrollInner: { padding: 20, paddingBottom: 12, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#3D2B00' },
  targetRow: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  targetLabel: { fontSize: 14, color: '#7A5400' },
  targetName: { fontSize: 16, fontWeight: '700', color: '#3D2B00', flexShrink: 1 },
  warningCard: {
    backgroundColor: '#FFF3D6',
    borderColor: '#B8860B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 6,
  },
  warningHeading: { fontSize: 15, fontWeight: '700', color: '#7A5400' },
  warningLine:    { fontSize: 14, color: '#3D2B00', lineHeight: 20 },
  warningLineDanger: { fontSize: 14, color: '#B1402B', fontWeight: '600', lineHeight: 20 },
  confirmHint: { fontSize: 14, color: '#3D2B00', marginTop: 8 },
  targetNameLarge: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3D2B00',
    backgroundColor: '#FFF8E1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  input: {
    minHeight: 48,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D4A017',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#3D2B00',
  },
  errorBox: {
    backgroundColor: '#FBEAE5',
    borderColor: '#B1402B',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
  },
  errorText: { fontSize: 14, color: '#B1402B', lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EAD9A8',
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  cancelBtnText: { fontSize: 15, color: '#555', fontWeight: '600' },
  confirmBtn: {
    flex: 1.4,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#B1402B',
    borderRadius: 8,
  },
  confirmBtnDisabled: { backgroundColor: '#D7B6AC' },
  confirmBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});
