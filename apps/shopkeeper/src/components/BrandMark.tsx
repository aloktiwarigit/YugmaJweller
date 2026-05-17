import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { radii } from '@goldsmith/ui-tokens';
import appIcon from '../../assets/app/icon.png';

interface BrandMarkProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function BrandMark({ size = 40, style }: BrandMarkProps): React.ReactElement {
  return (
    <Image
      source={appIcon}
      resizeMode="cover"
      accessible={false}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size >= 64 ? radii.lg : radii.md,
        },
        style,
      ]}
    />
  );
}
