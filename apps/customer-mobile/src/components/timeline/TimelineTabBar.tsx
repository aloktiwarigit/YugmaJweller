import React from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

export type TimelineTab = 'purchases' | 'custom-orders' | 'rate-locks' | 'try-at-home';

const TABS: { id: TimelineTab; label: string }[] = [
  { id: 'purchases',    label: 'खरीदारी' },
  { id: 'custom-orders',label: 'कस्टम ऑर्डर' },
  { id: 'rate-locks',   label: 'दर-लॉक' },
  { id: 'try-at-home',  label: 'ट्राई-एट-होम' },
];

interface TimelineTabBarProps {
  activeTab:   TimelineTab;
  onTabChange: (tab: TimelineTab) => void;
}

export function TimelineTabBar({ activeTab, onTabChange }: TimelineTabBarProps): React.ReactElement {
  return (
    <View style={{ paddingVertical: spacing.sm }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              testID={isActive ? 'timeline-tab-active' : `timeline-tab-${tab.id}`}
              onPress={() => onTabChange(tab.id)}
              style={{
                minHeight:         48,
                paddingHorizontal: spacing.md,
                paddingVertical:   spacing.sm,
                borderRadius:      radii.pill,
                justifyContent:    'center',
                backgroundColor:   isActive ? colors.primary : colors.white,
                borderWidth:       isActive ? 0 : 1,
                borderColor:       colors.border,
              }}
            >
              <Text
                style={{
                  fontFamily: typography.body.family,
                  fontSize:   14,
                  color:      isActive ? colors.white : colors.inkMute,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
