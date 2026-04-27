import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export interface InvoiceShareCelebrationProps {
  visible: boolean;
  invoiceNumber: string;
  totalFormatted: string;
  onShare: () => void;
  onDismiss: () => void;
}

export function InvoiceShareCelebration({
  visible,
  invoiceNumber,
  totalFormatted,
  onShare,
  onDismiss,
}: InvoiceShareCelebrationProps): React.ReactElement | null {
  const shimmer = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShared(false);
      return;
    }
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        scale.setValue(1);
        shimmer.setValue(1);
        return;
      }
      scale.setValue(0.92);
      shimmer.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
        Animated.timing(shimmer, { toValue: 1, duration: 300, useNativeDriver: false }),
      ]).start();
    });
  }, [visible]);

  const handleShare = (): void => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
      const Haptics = require('expo-haptics') as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { /* not available in test/web */ }
    setShared(true);
    onShare();
  };

  const cardBg = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#f5eddd', '#fdf3e1', '#f5eddd'],
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }], backgroundColor: cardBg }]}>
          <Text style={styles.checkmark} accessibilityElementsHidden>✓</Text>
          <Text style={styles.title} accessibilityRole="header">Invoice जारी हुआ!</Text>
          <Text style={styles.invoiceNum}>#{invoiceNumber}</Text>
          <Text style={styles.total}>₹{totalFormatted}</Text>
          {shared ? (
            <Text style={styles.sentLabel} accessibilityLiveRegion="polite">भेज दिया! 🎉</Text>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="WhatsApp पर Invoice भेजें"
              hitSlop={8}
            >
              <Text style={styles.shareBtnText}>WhatsApp भेजें</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.dismissBtn}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="बंद करें"
            hitSlop={8}
          >
            <Text style={styles.dismissText}>बंद करें</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:          { width: '100%', maxWidth: 360, borderRadius: 20, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  checkmark:     { fontSize: 40, color: '#d4a84b', marginBottom: 8 },
  title:         { fontSize: 22, fontWeight: '700', color: '#1c1917', fontFamily: 'NotoSansDevanagari', textAlign: 'center' },
  invoiceNum:    { fontSize: 13, color: '#78716c', marginTop: 4 },
  total:         { fontSize: 28, fontWeight: '700', color: '#d4a84b', marginTop: 8, marginBottom: 20 },
  shareBtn:      { backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, minWidth: 200, alignItems: 'center', minHeight: 48 },
  shareBtnPressed: { opacity: 0.85 },
  shareBtnText:  { fontSize: 16, fontWeight: '700', color: '#ffffff', fontFamily: 'NotoSansDevanagari' },
  sentLabel:     { fontSize: 18, fontWeight: '700', color: '#16a34a', fontFamily: 'NotoSansDevanagari', marginBottom: 8 },
  dismissBtn:    { marginTop: 12, paddingVertical: 10, paddingHorizontal: 24, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dismissText:   { fontSize: 14, color: '#78716c', fontFamily: 'NotoSansDevanagari' },
});
