import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Svg, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { Skeleton } from '../primitives/Skeleton';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';

export interface RateHistoryPoint {
  date: string;
  perGramPaise: string;
  perGramRupees: string;
  source: string;
  stale: boolean;
}

export interface RateHistoryChartProps {
  data: RateHistoryPoint[];
  purity: string;
  range: '30d' | '90d' | '365d';
  loading?: boolean;
}

const CHART_HEIGHT = 200;
const PAD = { top: 20, right: 16, bottom: 40, left: 8 };
const DEFAULT_WIDTH = 320;

function shouldShowLabel(i: number, total: number, range: '30d' | '90d' | '365d'): boolean {
  if (i === 0 || i === total - 1) return true;
  if (range === '30d') return i % 7 === 0;
  if (range === '90d') return i % 14 === 0;
  return i % 30 === 0;
}

export function RateHistoryChart({
  data,
  purity: _purity,
  range,
  loading = false,
}: RateHistoryChartProps): React.ReactElement {
  const [svgWidth, setSvgWidth] = useState(DEFAULT_WIDTH);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setSvgWidth(w);
  }, []);

  const chartW = svgWidth - PAD.left - PAD.right;
  const chartH = CHART_HEIGHT - PAD.top - PAD.bottom;

  const paiseNums = useMemo(() => data.map((d) => parseInt(d.perGramPaise, 10)), [data]);
  const minVal = useMemo(() => Math.min(...paiseNums), [paiseNums]);
  const maxVal = useMemo(() => Math.max(...paiseNums), [paiseNums]);
  const valRange = maxVal - minVal || 1;

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
        y: PAD.top + (1 - (parseInt(d.perGramPaise, 10) - minVal) / valRange) * chartH,
        ...d,
      })),
    [data, chartW, chartH, minVal, valRange],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer} testID="rate-chart-loading">
        <Skeleton height={14} width={200} />
        <View style={{ height: spacing.sm ?? 8 }} />
        <Skeleton height={chartH} width={DEFAULT_WIDTH} />
        <View style={{ height: spacing.sm ?? 8 }} />
        <Skeleton height={14} width={150} />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText} testID="rate-chart-empty">
          कोई डेटा नहीं
        </Text>
      </View>
    );
  }

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const todayPt = points[points.length - 1];
  const todayDate = new Date().toISOString().slice(0, 10);
  const lastPointIsToday = todayPt?.date === todayDate;

  return (
    <View onLayout={onLayout} style={styles.wrapper}>
      <Svg width={svgWidth} height={CHART_HEIGHT} testID="rate-chart-svg">
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2}
        />

        {points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 5 : 3}
            fill={p.stale ? '#AAAAAA' : colors.primary}
            testID={`rate-chart-point-${i}`}
          />
        ))}

        {todayPt != null && (
          <SvgText
            x={todayPt.x}
            y={todayPt.y - 10}
            fill={colors.primary ?? '#8B6914'}
            fontSize={11}
            textAnchor="middle"
            fontFamily={typography.body.family}
          >
            {lastPointIsToday ? `आज ₹${todayPt.perGramRupees}` : `₹${todayPt.perGramRupees}`}
          </SvgText>
        )}

        {points.map((p, i) =>
          shouldShowLabel(i, points.length, range) ? (
            <SvgText
              key={`lbl-${i}`}
              x={p.x}
              y={CHART_HEIGHT - 4}
              fill={colors.textSecondary ?? '#888'}
              fontSize={9}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              fontFamily={typography.body.family}
            >
              {p.date.slice(5)}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.white,
  },
  loadingContainer: {
    padding: spacing.md ?? 16,
    alignItems: 'center',
    gap: spacing.sm ?? 8,
  },
  emptyContainer: {
    padding: spacing.xl ?? 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
