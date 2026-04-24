/**
 * Story 4.4 — RateWidget component tests
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RateWidget } from '../src/business/RateWidget';
import type { PublicRatesResponse } from '../src/business/RateWidget';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FRESH_AT = new Date(Date.now() - 2000).toISOString();

const freshRates: PublicRatesResponse = {
  GOLD_24K: { perGramRupees: '7350.00', formattedINR: '₹7,350.00', fetchedAt: FRESH_AT },
  GOLD_22K: { perGramRupees: '6737.50', formattedINR: '₹6,737.50', fetchedAt: FRESH_AT },
  SILVER_999: { perGramRupees: '95.00', formattedINR: '₹95.00', fetchedAt: FRESH_AT },
  stale: false,
  source: 'ibja',
  refreshedAt: FRESH_AT,
};

const staleRates: PublicRatesResponse = {
  ...freshRates,
  stale: true,
  refreshedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
};

// ---------------------------------------------------------------------------
// Full variant
// ---------------------------------------------------------------------------

describe('RateWidget — full variant', () => {
  it('renders 3 rate rows', () => {
    const { getByTestId } = render(<RateWidget variant="full" rates={freshRates} />);
    expect(getByTestId('rate-widget-row-GOLD_24K')).toBeTruthy();
    expect(getByTestId('rate-widget-row-GOLD_22K')).toBeTruthy();
    expect(getByTestId('rate-widget-row-SILVER_999')).toBeTruthy();
  });

  it('shows green dot for fresh rates (< 30 min old)', () => {
    const { getByTestId } = render(<RateWidget variant="full" rates={freshRates} />);
    const dot = getByTestId('rate-widget-dot-GOLD_22K');
    // jsdom normalizes hex colours to rgb()
    expect(dot.style.backgroundColor).toBe('rgb(34, 197, 94)'); // #22c55e
  });

  it('shows red dot for stale rates', () => {
    const { getByTestId } = render(<RateWidget variant="full" rates={staleRates} />);
    const dot = getByTestId('rate-widget-dot-GOLD_22K');
    expect(dot.style.backgroundColor).toBe('rgb(239, 68, 68)'); // #ef4444
  });

  it('shows offline message when rates are null', () => {
    const { getByTestId, getByText } = render(<RateWidget variant="full" rates={null} />);
    expect(getByTestId('rate-widget-offline')).toBeTruthy();
    expect(getByText('दर अस्थायी रूप से उपलब्ध नहीं')).toBeTruthy();
  });

  it('each row has accessibilityLabel with metal name and price', () => {
    const { getByTestId } = render(<RateWidget variant="full" rates={freshRates} />);
    const row24k = getByTestId('rate-widget-row-GOLD_24K');
    expect(row24k.getAttribute('accessibilitylabel')).toContain('24 कैरेट सोना');
    expect(row24k.getAttribute('accessibilitylabel')).toContain('₹7,350.00');
  });

  it('offline container has accessibilityLiveRegion polite', () => {
    const { getByTestId } = render(<RateWidget variant="full" rates={null} />);
    expect(getByTestId('rate-widget-offline').getAttribute('accessibilityliveregion')).toBe('polite');
  });

  it('renders Hindi metal labels', () => {
    const { getByText } = render(<RateWidget variant="full" rates={freshRates} />);
    expect(getByText('24 कैरेट सोना')).toBeTruthy();
    expect(getByText('22 कैरेट सोना')).toBeTruthy();
    expect(getByText('चाँदी 999')).toBeTruthy();
  });

  it('shows skeleton when loading=true', () => {
    const { getByTestId, queryByTestId } = render(
      <RateWidget variant="full" rates={null} loading />,
    );
    expect(getByTestId('rate-widget-loading')).toBeTruthy();
    expect(queryByTestId('rate-widget-full')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Compact variant
// ---------------------------------------------------------------------------

describe('RateWidget — compact variant', () => {
  it('renders single-line with 22K and 24K rates', () => {
    const { getByTestId } = render(<RateWidget variant="compact" rates={freshRates} />);
    const compact = getByTestId('rate-widget-compact');
    expect(compact.textContent).toContain('22K');
    expect(compact.textContent).toContain('24K');
  });

  it('calls onPress when tapped', () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <RateWidget variant="compact" rates={freshRates} onPress={onPress} />,
    );
    getByTestId('rate-widget-compact').click();
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('shows offline placeholder when rates are null', () => {
    const { getByTestId, queryByTestId } = render(
      <RateWidget variant="compact" rates={null} />,
    );
    expect(getByTestId('rate-widget-offline')).toBeTruthy();
    expect(queryByTestId('rate-widget-compact')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Ticker variant
// ---------------------------------------------------------------------------

describe('RateWidget — ticker variant', () => {
  it('renders ticker content with all 3 purities', () => {
    const { getByTestId } = render(<RateWidget variant="ticker" rates={freshRates} />);
    const content = getByTestId('rate-widget-ticker-content');
    expect(content.textContent).toContain('22K');
    expect(content.textContent).toContain('24K');
    expect(content.textContent).toContain('999');
  });

  it('renders ticker container', () => {
    const { getByTestId } = render(<RateWidget variant="ticker" rates={freshRates} />);
    expect(getByTestId('rate-widget-ticker')).toBeTruthy();
  });

  it('shows offline placeholder when rates are null', () => {
    const { getByTestId } = render(<RateWidget variant="ticker" rates={null} />);
    expect(getByTestId('rate-widget-offline')).toBeTruthy();
  });
});
