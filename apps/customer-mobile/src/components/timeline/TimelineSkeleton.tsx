import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { colors, spacing, radii } from '@goldsmith/ui-tokens';

function SkeletonRow(): React.ReactElement {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0.8, duration: 600, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        opacity,
        minHeight:       72,
        padding:         spacing.md,
        borderRadius:    radii.md,
        borderWidth:     1,
        borderColor:     colors.border,
        marginBottom:    spacing.sm,
        backgroundColor: colors.primaryLight,
      }}
    />
  );
}

export function TimelineSkeleton(): React.ReactElement {
  return (
    <View>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}
