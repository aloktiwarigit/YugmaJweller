import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RateHistoryChart } from '../src/business/RateHistoryChart';
import type { RateHistoryPoint } from '../src/business/RateHistoryChart';

function makePoint(date: string, paise: number, stale = false): RateHistoryPoint {
  return {
    date,
    perGramPaise: String(paise),
    perGramRupees: (paise / 100).toFixed(2),
    source: 'ibja',
    stale,
  };
}

const SAMPLE_DATA: RateHistoryPoint[] = [
  makePoint('2026-03-26', 673750),
  makePoint('2026-03-27', 675000),
  makePoint('2026-03-28', 671000, true),
  makePoint('2026-03-29', 680000),
  makePoint('2026-03-30', 682500),
];

describe('RateHistoryChart', () => {
  it('renders one SVG dot per data point', () => {
    const { container } = render(
      <RateHistoryChart data={SAMPLE_DATA} purity="GOLD_22K" range="30d" />,
    );
    const dots = container.querySelectorAll('[data-testid^="rate-chart-point-"]');
    expect(dots).toHaveLength(SAMPLE_DATA.length);
  });

  it('loading state renders skeleton placeholder instead of chart', () => {
    const { getByTestId, queryByTestId } = render(
      <RateHistoryChart data={[]} purity="GOLD_22K" range="30d" loading />,
    );
    expect(getByTestId('rate-chart-loading')).toBeTruthy();
    expect(queryByTestId('rate-chart-svg')).toBeNull();
  });

  it('empty data shows "कोई डेटा नहीं" message', () => {
    const { getByTestId, queryByTestId } = render(
      <RateHistoryChart data={[]} purity="GOLD_22K" range="30d" />,
    );
    expect(getByTestId('rate-chart-empty')).toBeTruthy();
    expect(queryByTestId('rate-chart-svg')).toBeNull();
  });

  it('renders SVG chart when data is present', () => {
    const { getByTestId } = render(
      <RateHistoryChart data={SAMPLE_DATA} purity="GOLD_22K" range="30d" />,
    );
    expect(getByTestId('rate-chart-svg')).toBeTruthy();
  });

  it('single data point renders without crashing', () => {
    const { container } = render(
      <RateHistoryChart data={[makePoint('2026-03-30', 682500)]} purity="GOLD_22K" range="30d" />,
    );
    const dots = container.querySelectorAll('[data-testid^="rate-chart-point-"]');
    expect(dots).toHaveLength(1);
  });
});
