import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  COMPLETED:       { label: 'पूर्ण',      bg: '#2D6A4F' },
  PAID:            { label: 'पूर्ण',      bg: '#2D6A4F' },
  DELIVERED:       { label: 'पूर्ण',      bg: '#2D6A4F' },
  PENDING:         { label: 'लंबित',      bg: '#B8860B' },
  PENDING_PAYMENT: { label: 'लंबित',      bg: '#B8860B' },
  DEPOSIT_PENDING: { label: 'लंबित',      bg: '#B8860B' },
  ACTIVE:          { label: 'सक्रिय',     bg: '#1D4ED8' },
  IN_PROGRESS:     { label: 'जारी',       bg: '#1D4ED8' },
  REQUESTED:       { label: 'जारी',       bg: '#1D4ED8' },
  READY:           { label: 'तैयार',      bg: '#1D4ED8' },
  CANCELLED:       { label: 'रद्द',       bg: '#6B7280' },
  EXPIRED:         { label: 'समाप्त',     bg: '#6B7280' },
  USED:            { label: 'उपयोग हुआ',  bg: '#6B7280' },
  IN_TRY_AT_HOME:  { label: 'जारी है',    bg: '#7C3AED' },
  DISPATCHED:      { label: 'भेजा गया',   bg: '#7C3AED' },
};

interface TimelineCardProps {
  status:  string;
  title:   string;
  subLine: string;
  date:    string;
}

export function TimelineCard({ status, title, subLine, date }: TimelineCardProps): React.ReactElement {
  const chip = STATUS_CONFIG[status] ?? { label: status, bg: '#6B7280' };
  return (
    <View
      style={{
        minHeight:       72,
        padding:         spacing.md,
        borderRadius:    radii.md,
        borderWidth:     1,
        borderColor:     colors.border,
        marginBottom:    spacing.sm,
        backgroundColor: colors.white,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <View
          testID="timeline-card-status"
          style={{
            backgroundColor:   chip.bg,
            paddingHorizontal: 8,
            paddingVertical:   3,
            borderRadius:      radii.pill,
          }}
        >
          <Text style={{ color: colors.white, fontSize: 12, fontFamily: typography.body.family }}>
            {chip.label}
          </Text>
        </View>
        <Text style={{ color: colors.inkMute, fontSize: 12, fontFamily: typography.body.family }}>
          {date}
        </Text>
      </View>
      <Text
        testID="timeline-card-title"
        style={{
          fontFamily:   typography.display.family,
          fontSize:     16,
          color:        colors.ink,
          marginBottom: spacing.xs,
        }}
      >
        {title}
      </Text>
      <Text
        testID="timeline-card-subline"
        style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute }}
      >
        {subLine}
      </Text>
    </View>
  );
}
