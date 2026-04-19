import React from 'react';
import { View } from 'react-native';
import { colors, radii } from '@goldsmith/ui-tokens';

export interface SkeletonProps {
  height?: number;
  width?: number;
  testID?: string;
}

export function Skeleton({ height = 16, width = 120, testID }: SkeletonProps): React.ReactElement {
  return (
    <View
      testID={testID}
      accessibilityRole="none"
      style={{
        height,
        width,
        borderRadius: radii.sm,
        backgroundColor: colors.border,
        opacity: 0.6,
      }}
    />
  );
}
