import React from 'react';
import { View, Text } from 'react-native';
import { t } from '@goldsmith/i18n';

interface PlaceholderScreenProps {
  titleKey: string;
}

export default function PlaceholderScreen({ titleKey }: PlaceholderScreenProps): React.ReactElement {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 18, color: '#6B6B6B' }}>{t(titleKey)}</Text>
    </View>
  );
}
