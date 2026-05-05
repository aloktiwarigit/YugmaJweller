import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import type { TimelineTab } from './TimelineTabBar';

const EMPTY_COPY: Record<TimelineTab, { icon: string; headline: string; subtext: string }> = {
  'purchases':     { icon: '🧾', headline: 'अभी तक कोई खरीदारी नहीं',        subtext: 'दुकान पर जाएं और अपनी पहली खरीद करें' },
  'custom-orders': { icon: '💍', headline: 'कोई कस्टम ऑर्डर नहीं',            subtext: 'अपने सपनों का गहना बनवाएं' },
  'rate-locks':    { icon: '🔒', headline: 'कोई दर-लॉक नहीं',                  subtext: 'सोने की कीमत लॉक करें, बाद में खरीदें' },
  'try-at-home':   { icon: '🏠', headline: 'कोई ट्राई-एट-होम बुकिंग नहीं',    subtext: 'घर पर गहने देखें और पसंद करें' },
  'reviews':       { icon: '⭐', headline: 'कोई समीक्षा नहीं',                 subtext: 'अपनी खरीद पर समीक्षा दें' },
};

interface TimelineEmptyStateProps {
  tab: TimelineTab;
}

export function TimelineEmptyState({ tab }: TimelineEmptyStateProps): React.ReactElement {
  const { icon, headline, subtext } = EMPTY_COPY[tab];
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }}>
      <Text style={{ fontSize: 40, marginBottom: spacing.md }}>{icon}</Text>
      <Text
        style={{
          fontFamily:   typography.display.family,
          fontSize:     18,
          fontWeight:   'bold',
          color:        colors.ink,
          textAlign:    'center',
          marginBottom: spacing.xs,
        }}
      >
        {headline}
      </Text>
      <Text
        style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, textAlign: 'center' }}
      >
        {subtext}
      </Text>
    </View>
  );
}
