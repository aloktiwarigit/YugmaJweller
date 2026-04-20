import React from 'react';
import { View, Text, ViewStyle } from 'react-native';

interface SettingsGroupCardProps {
  title: string;
  children: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
}

export function SettingsGroupCard({ title, children, testID, style }: SettingsGroupCardProps) {
  return (
    <View
      testID={testID}
      style={[{
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 16,
        paddingBottom: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }, style]}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: '#888',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
