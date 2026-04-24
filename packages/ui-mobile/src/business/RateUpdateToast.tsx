import React, { useEffect, useRef } from 'react';
import {
  Animated,
  AccessibilityInfo,
  StyleSheet,
  Text,
} from 'react-native';
import { colors, radii, spacing, typography } from '@goldsmith/ui-tokens';

export interface RateUpdateToastProps {
  visible: boolean;
  onDismiss: () => void;
  message?: string;
}

const DEFAULT_MESSAGE = 'आज का भाव अद्यतन हो गया';
const AUTO_DISMISS_MS = 2000;

export function RateUpdateToast({
  visible,
  onDismiss,
  message = DEFAULT_MESSAGE,
}: RateUpdateToastProps): React.ReactElement | null {
  const translateY = useRef(new Animated.Value(80)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // Haptic on appear — wrapped in try/catch; expo-haptics is a peer dep of the consuming app
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
      const Haptics = require('expo-haptics') as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // not available in test / web
    }

    let cancelled = false;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      translateY.setValue(80);
      bgAnim.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(bgAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(bgAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
        ]),
      ]).start();
    });

    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible]); // onDismiss excluded: stable callback assumed from caller

  if (!visible) return null;

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.primary, '#D4A84B'],
  });

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }], backgroundColor }]}
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      accessible
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    minWidth: 200,
    maxWidth: 320,
    borderRadius: radii.md ?? 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    alignItems: 'center',
  } as const,
  text: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
