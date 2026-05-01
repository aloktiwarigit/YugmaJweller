import React from 'react';
import { View } from 'react-native';
import { colors } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { ComingSoon } from '../../src/components/ComingSoon';

export default function Browse(): React.ReactElement {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ComingSoon />
    </View>
  );
}
