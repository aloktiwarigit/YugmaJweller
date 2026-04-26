import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  Animated,
  ActivityIndicator,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import type { InvoiceResponse } from '@goldsmith/shared';

const VOID_WINDOW_MS = 24 * 60 * 60 * 1000;

function isWithinVoidWindow(issuedAt: string | null | undefined): boolean {
  if (!issuedAt) return false;
  return Date.now() < new Date(issuedAt).getTime() + VOID_WINDOW_MS;
}

interface Props {
  visible:      boolean;
  invoice:      InvoiceResponse;
  userRole:     string | undefined;
  onClose:      () => void;
  onSuccess:    () => void;
}

export function VoidInvoiceSheet({ visible, invoice, userRole, onClose, onSuccess }: Props): JSX.Element {
  const slideAnim   = useRef(new Animated.Value(400)).current;
  const [reason, setReason] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const queryClient = useQueryClient();

  const withinWindow = isWithinVoidWindow(invoice.issuedAt);
  const isOwner = userRole === 'shop_admin';

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    } else {
      slideAnim.setValue(400);
      setReason('');
      setConfirmVisible(false);
    }
  }, [visible, slideAnim]);

  const voidMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/billing/invoices/${invoice.id}/void`, { reason: reason.trim() || 'रद्द' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      AccessibilityInfo.announceForAccessibility('Invoice रद्द हो गई');
      onSuccess();
    },
  });

  const creditNoteMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/billing/invoices/${invoice.id}/credit-note`, { reason: reason.trim() || 'Credit note' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      AccessibilityInfo.announceForAccessibility('Credit note जारी हो गई');
      onSuccess();
    },
  });

  const handleAction = useCallback(() => {
    if (withinWindow) {
      setConfirmVisible(true);
    } else {
      creditNoteMutation.mutate();
    }
  }, [withinWindow, creditNoteMutation]);

  const handleConfirmVoid = useCallback(() => {
    setConfirmVisible(false);
    voidMutation.mutate();
  }, [voidMutation]);

  const isPending = voidMutation.isPending || creditNoteMutation.isPending;
  const isError   = voidMutation.isError   || creditNoteMutation.isError;
  const errorMsg  =
    ((voidMutation.error || creditNoteMutation.error) as { response?: { data?: { message?: string } } } | null)
      ?.response?.data?.message ?? 'कुछ गड़बड़ी हुई। दोबारा कोशिश करें।';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="बंद करें" />

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        accessibilityLabel={withinWindow ? 'Invoice रद्द करें' : 'Credit Note जारी करें'}
      >
        <View style={styles.handle} />

        {/* Non-owner: read-only notice */}
        {!isOwner ? (
          <>
            <Text style={styles.heading}>Invoice रद्द करें</Text>
            <View style={styles.readOnlyBox}>
              <Text style={styles.readOnlyText}>
                केवल owner void कर सकते हैं।
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.cancelBtn} accessibilityRole="button">
              <Text style={styles.cancelText}>बंद करें</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.heading}>
              {withinWindow ? 'Invoice रद्द करें' : 'Credit Note जारी करें'}
            </Text>

            <Text style={styles.subtext}>
              {withinWindow
                ? 'Invoice 24 घंटे के अंदर है — पूरी तरह रद्द की जा सकती है।'
                : 'Invoice 24 घंटे से पुरानी है — credit note जारी करें।'}
            </Text>

            <Text style={styles.fieldLabel}>कारण</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              style={styles.input}
              placeholder={withinWindow ? 'रद्द करने का कारण' : 'Credit note का कारण'}
              maxLength={300}
              multiline
              numberOfLines={2}
              accessibilityLabel="कारण"
              editable={!isPending}
            />

            {isError && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {errorMsg}
              </Text>
            )}

            <Pressable
              onPress={handleAction}
              style={[styles.actionBtn, isPending && styles.actionBtnDisabled]}
              accessibilityRole="button"
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>
                  {withinWindow ? 'Invoice रद्द करें' : 'Credit Note जारी करें'}
                </Text>
              )}
            </Pressable>

            <Pressable onPress={onClose} style={styles.cancelBtn} accessibilityRole="button" disabled={isPending}>
              <Text style={styles.cancelText}>रद्द करें</Text>
            </Pressable>
          </>
        )}
      </Animated.View>

      {/* Confirmation dialog for void (destructive — extra step) */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
        accessibilityViewIsModal
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>क्या आप sure हैं?</Text>
            <Text style={styles.dialogBody}>
              यह invoice पूरी तरह रद्द हो जाएगी। क्या आप sure हैं?
            </Text>
            <View style={styles.dialogRow}>
              <Pressable
                onPress={() => setConfirmVisible(false)}
                style={styles.dialogCancelBtn}
                accessibilityRole="button"
              >
                <Text style={styles.dialogCancelText}>नहीं</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmVoid}
                style={styles.dialogConfirmBtn}
                accessibilityRole="button"
              >
                <Text style={styles.dialogConfirmText}>हाँ, रद्द करें</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 36,
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
  subtext: {
    fontSize: 14,
    fontFamily: 'NotoSansDevanagari',
    color: '#78716c',
    marginBottom: 16,
    lineHeight: 20,
  },
  readOnlyBox: {
    backgroundColor: '#fef9c3',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  readOnlyText: {
    fontSize: 15,
    fontFamily: 'NotoSansDevanagari',
    color: '#78350f',
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
    fontSize: 15,
    fontFamily: 'NotoSansDevanagari',
    marginBottom: 12,
    backgroundColor: '#ffffff',
    minHeight: 56,
    textAlignVertical: 'top',
    color: '#1c1917',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontFamily: 'NotoSansDevanagari',
    marginBottom: 10,
  },
  actionBtn: {
    backgroundColor: '#b91c1c',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 56,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
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
  // Confirmation dialog styles
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'NotoSansDevanagari',
    color: '#1c1917',
    marginBottom: 8,
  },
  dialogBody: {
    fontSize: 15,
    fontFamily: 'NotoSansDevanagari',
    color: '#44403c',
    marginBottom: 20,
    lineHeight: 22,
  },
  dialogRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dialogCancelBtn: {
    flex: 1,
    backgroundColor: '#f5f5f4',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  dialogCancelText: {
    fontSize: 16,
    fontFamily: 'NotoSansDevanagari',
    color: '#44403c',
  },
  dialogConfirmBtn: {
    flex: 1,
    backgroundColor: '#b91c1c',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  dialogConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'NotoSansDevanagari',
    color: '#ffffff',
  },
});
