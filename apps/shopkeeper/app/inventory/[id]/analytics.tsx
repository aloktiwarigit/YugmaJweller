import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Svg, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { colors, spacing, typography, radii } from '@goldsmith/ui-tokens';
import { useProductAnalytics } from '../../../src/features/inventory/analytics/useProductAnalytics';
import type { ViewSummary } from '../../../src/features/inventory/analytics/useProductAnalytics';

type Period = '30d' | '90d' | '365d';

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: '30d', label: '30 दिन' },
  { key: '90d', label: '90 दिन' },
  { key: '365d', label: '365 दिन' },
];

const CHART_HEIGHT = 180;
const PAD = { top: 20, right: 16, bottom: 36, left: 8 };
const DEFAULT_WIDTH = 320;

interface ChartPoint {
  label: string;
  totalViews: number;
}

function StatCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.statCard} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TrendChart({ data, loading }: { data: ChartPoint[]; loading: boolean }): React.ReactElement {
  const [svgWidth, setSvgWidth] = useState(DEFAULT_WIDTH);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setSvgWidth(w);
  }, []);

  // All hooks must be called unconditionally (Rules of Hooks) — compute derived
  // values before any early return, even when loading or data is empty.
  const values = useMemo(() => data.map((d) => d.totalViews), [data]);
  const minV = useMemo(() => (values.length > 0 ? Math.min(...values) : 0), [values]);
  const maxV = useMemo(() => (values.length > 0 ? Math.max(...values) : 1) || 1, [values]);
  const range = useMemo(() => maxV - minV || 1, [maxV, minV]);

  const chartW = svgWidth - PAD.left - PAD.right;
  const chartH = CHART_HEIGHT - PAD.top - PAD.bottom;

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
        y: PAD.top + (1 - (d.totalViews - minV) / range) * chartH,
        label: d.label,
        totalViews: d.totalViews,
      })),
    [data, chartW, chartH, minV, range],
  );

  const polyline = useMemo(() => points.map((p) => `${p.x},${p.y}`).join(' '), [points]);

  if (loading) {
    return (
      <View style={styles.chartPlaceholder} testID="analytics-chart-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (data.length === 0) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.emptyText}>डेटा उपलब्ध नहीं</Text>
      </View>
    );
  }

  return (
    <View onLayout={onLayout} style={styles.chartWrapper} testID="analytics-chart-svg-container">
      <Svg width={svgWidth} height={CHART_HEIGHT} testID="analytics-chart-svg">
        <Polyline points={polyline} fill="none" stroke={colors.primary} strokeWidth={2} />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.primary} testID={`analytics-chart-point-${i}`} />
        ))}
        {points.map((p, i) => (
          <SvgText
            key={`lbl-${i}`}
            x={p.x}
            y={CHART_HEIGHT - 4}
            fill={colors.textSecondary}
            fontSize={10}
            textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
            fontFamily={typography.body.family}
          >
            {p.label}
          </SvgText>
        ))}
        {points.map((p, i) => (
          <SvgText
            key={`val-${i}`}
            x={p.x}
            y={p.y - 8}
            fill={colors.primary}
            fontSize={10}
            textAnchor="middle"
            fontFamily={typography.body.family}
          >
            {p.totalViews}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

function formatDuration(secs: number | null): string {
  if (secs === null) return '—';
  if (secs < 60) return `${Math.round(secs)} से.`;
  return `${Math.round(secs / 60)} मि.`;
}

export default function ProductAnalyticsScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [period, setPeriod] = useState<Period>('30d');
  const { data, isLoading, error } = useProductAnalytics(id);

  const chartData: ChartPoint[] = data
    ? PERIOD_OPTIONS.map((p) => ({
        label: p.label,
        totalViews: data[p.key]?.totalViews ?? 0,
      }))
    : [];

  const summary: ViewSummary | undefined = data?.[period];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>देखने का विश्लेषण</Text>

      {error ? <Text style={styles.errorText}>लोड नहीं हो सका</Text> : null}

      <View style={styles.chartCard}>
        <Text style={styles.sectionLabel}>तीनों अवधि में कुल देखना</Text>
        <TrendChart data={chartData} loading={isLoading} />
      </View>

      <View style={styles.segmentRow} accessibilityRole="radiogroup">
        {PERIOD_OPTIONS.map((opt) => {
          const active = period === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setPeriod(opt.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
      ) : summary ? (
        <View style={styles.statsRow}>
          <StatCard label="कुल बार देखा" value={String(summary.totalViews)} />
          <StatCard label="अनूठे दर्शक" value={String(summary.uniqueViewers)} />
          <StatCard label="औसत समय" value={formatDuration(summary.avgDurationSeconds)} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl ?? 32 },
  heading: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontFamily: 'NotoSansDevanagari_400Regular',
    textAlign: 'center',
    padding: spacing.md,
  },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md ?? 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    padding: spacing.sm ?? 8,
  },
  sectionLabel: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs ?? 4,
  },
  chartWrapper: { backgroundColor: colors.white },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.xs ?? 4,
    marginBottom: spacing.md,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: radii.sm ?? 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  segmentText: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 14,
    color: colors.textPrimary,
  },
  segmentTextActive: { color: colors.primary, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm ?? 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md ?? 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs ?? 4,
  },
});
